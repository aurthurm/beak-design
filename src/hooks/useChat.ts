import { useState, useCallback, useMemo, useRef } from 'react'
import type {
  ChatMessage,
  ConversationTab,
} from '../components/chat/ChatPanel'
import { handleToolExecutionAnimation } from '../lib/ai/agent-animations'
import { getDefaultAgentId, getAgentConfig } from '../lib/ai/agent-config'
import type { AgentConfig } from '../lib/ai/agent-config'

interface UseChatOptions {
  selectedIDs: string[]
}

interface UseChatReturn {
  conversations: ConversationTab[]
  activeConversationId: string
  onSelectConversation: (conversationId: string) => void
  onCreateConversation: () => void
  onCloseConversation: (conversationId: string) => void
  onSendMessage: (params: {
    prompt: string
    conversationId?: string
    agentType?: string
    agentConfig?: AgentConfig
  }) => void
  onStopConversation: (conversationId: string) => void
}

export function useChat({ selectedIDs }: UseChatOptions): UseChatReturn {
  const createNewConversation = useCallback((): ConversationTab => {
    // Get default agent config from settings
    let agentConfig: AgentConfig | undefined
    let agentType = 'cloud'
    if (typeof window !== 'undefined') {
      const defaultAgentId = getDefaultAgentId()
      if (defaultAgentId) {
        agentConfig = getAgentConfig(defaultAgentId)
        if (agentConfig) {
          agentType = agentConfig.type
        }
      }
      
      // If no config found, create default cloud config
      if (!agentConfig) {
        agentConfig = {
          id: 'cloud-anthropic',
          name: 'Cloud',
          type: 'cloud',
          enabled: true,
          metadata: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022', // Default model
          },
        }
      }
    }

    return {
      id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: 'New Chat',
      agentType,
      agentConfig,
      messages: [],
      isRunning: false,
      lastUpdatedAt: Date.now(),
    }
  }, [])

  const [conversations, setConversations] = useState<ConversationTab[]>(() => [
    createNewConversation(),
  ])
  const [activeConversationId, setActiveConversationId] = useState<string>(
    () => conversations[0]?.id ?? ''
  )

  const onCreateConversation = useCallback(() => {
    const newConv = createNewConversation()
    setConversations((prev) => [...prev, newConv])
    setActiveConversationId(newConv.id)
  }, [createNewConversation])

  const onCloseConversation = useCallback(
    (conversationId: string) => {
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== conversationId)
        if (filtered.length === 0) {
          const newConv = createNewConversation()
          return [newConv]
        }
        return filtered
      })
    },
    [createNewConversation]
  )

  const onSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId)
  }, [])


  // AbortController for canceling requests
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const onSendMessage = useCallback(
    async ({
      prompt,
      conversationId,
      agentType,
      agentConfig,
    }: {
      prompt: string
      conversationId?: string
      agentType?: string
      agentConfig?: AgentConfig
    }) => {
      let conversation = conversations.find((c) => c.id === conversationId)

      if (!conversationId) {
        const activeConversation = conversations.find((c) => c.id === activeConversationId)
        if (activeConversation?.messages.length === 0) {
          conversation = activeConversation
        } else {
          conversation = createNewConversation()
          setConversations((prev) => [...prev, conversation!])
          setActiveConversationId(conversation.id)
        }
      }

      if (!conversation) return

      // Use agentConfig from conversation or provided, fallback to default
      const finalAgentConfig = agentConfig || conversation.agentConfig || (() => {
        const defaultAgentId = getDefaultAgentId()
        return defaultAgentId ? getAgentConfig(defaultAgentId) : undefined
      })()
      
      const finalAgentType = agentType || conversation.agentType || 'cloud'

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: 'user',
        text: prompt,
        createdAt: Date.now(),
        status: 'final',
      }

      // Add user message
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversation!.id) return c
          return {
            ...c,
            messages: [...c.messages, userMessage],
            isRunning: true,
            lastUpdatedAt: Date.now(),
            title:
              c.messages.length === 0
                ? prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '')
                : c.title,
          }
        })
      )

      try {
        // Create abort controller for this request
        const abortController = new AbortController()
        abortControllersRef.current.set(conversation.id, abortController)

        // Get API key from localStorage if using cloud agent
        let apiKey: string | undefined
        if ((agentType || 'cloud') === 'cloud') {
          const savedKey = localStorage.getItem('ai-api-key-anthropic')
          if (savedKey && !savedKey.includes('...')) {
            apiKey = savedKey
          }
        }

        // Send to AI API
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              ...conversation.messages.map((m) => ({
                role: m.role,
                text: m.text,
              })),
              { role: 'user', text: prompt },
            ],
            agentType: finalAgentType,
            agentConfig: finalAgentConfig,
            apiKey, // Include API key from localStorage
            selectedIDs,
            conversationId: conversation.id,
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText)
          let parsedError: string | null = null

          // Try to parse SSE-style error event
          const trimmed = errorText?.trim()
          if (trimmed) {
            const dataLines = trimmed
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.startsWith('data:'))
            for (const line of dataLines) {
              const payload = line.slice(6).trim()
              try {
                const parsed = JSON.parse(payload)
                if (parsed?.error) {
                  parsedError = parsed.error
                  break
                }
              } catch {
                // ignore JSON parse errors
              }
            }

            if (!parsedError) {
              try {
                const json = JSON.parse(trimmed)
                if (json?.error) {
                  parsedError = json.error
                }
              } catch {
                // ignore non-JSON content
              }
            }
          }

          let errorMessage =
            parsedError || `API error: ${response.statusText}`

          if (response.status === 500 && !parsedError) {
            errorMessage = 'Server error. Please try again later.'
          } else if (response.status === 401) {
            errorMessage = parsedError || 'API key not configured. Please set ANTHROPIC_API_KEY in your environment.'
          } else if (response.status === 503) {
            errorMessage = parsedError || 'Service unavailable. Please check your connection.'
          } else if (response.status === 429) {
            errorMessage = parsedError || 'Rate limit exceeded. Please wait a moment before trying again.'
          }

          throw new Error(errorMessage)
        }

        // Handle SSE streaming
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        let assistantText = ''

        // Create initial streaming message
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversation!.id) return c
            return {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: assistantMessageId,
                  role: 'assistant',
                  text: '',
                  createdAt: Date.now(),
                  status: 'streaming' as const,
                },
              ],
            }
          })
        )

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  
                  if (data.type === 'text-delta') {
                    assistantText += data.content || ''
                    // Update streaming message
                    setConversations((prev) =>
                      prev.map((c) => {
                        if (c.id !== conversation!.id) return c
                        return {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === assistantMessageId
                              ? { ...m, text: assistantText }
                              : m
                          ),
                        }
                      })
                    )
                  } else if (data.type === 'tool-call') {
                    // Add tool use message
                    const toolMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
                    setConversations((prev) =>
                      prev.map((c) => {
                        if (c.id !== conversation!.id) return c
                        return {
                          ...c,
                          messages: [
                            ...c.messages,
                            {
                              id: toolMessageId,
                              role: 'tool',
                              text: `Using tool: ${data.name}`,
                              createdAt: Date.now(),
                              status: 'final' as const,
                              toolUse: {
                                name: data.name,
                                input: data.input,
                              },
                            },
                          ],
                        }
                      })
                    )
                  } else if (data.type === 'tool-result') {
                    // Update tool use message with result
                    setConversations((prev) =>
                      prev.map((c) => {
                        if (c.id !== conversation!.id) return c
                        return {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.role === 'tool' && m.toolUse?.name === data.name
                              ? {
                                  ...m,
                                  toolUse: {
                                    ...m.toolUse!,
                                    output: data.result,
                                    isError: data.error || false,
                                  },
                                }
                              : m
                          ),
                        }
                      })
                    )

                    // Trigger animations for agent operations
                    if (!data.error) {
                      handleToolExecutionAnimation(
                        data.name,
                        data.input,
                        data.result,
                        false
                      )
                    }
                  } else if (data.type === 'error') {
                    // Handle error from API
                    const errorMessage: ChatMessage = {
                      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                      role: 'assistant',
                      text: `Error: ${data.error || 'An error occurred'}`,
                      createdAt: Date.now(),
                      status: 'final',
                    }

                    setConversations((prev) =>
                      prev.map((c) => {
                        if (c.id !== conversation!.id) return c
                        return {
                          ...c,
                          messages: [
                            ...c.messages.filter((m) => m.id !== assistantMessageId),
                            errorMessage,
                          ],
                          isRunning: false,
                          lastUpdatedAt: Date.now(),
                        }
                      })
                    )
                  } else if (data.type === 'done') {
                    // Mark streaming message as final
                    setConversations((prev) =>
                      prev.map((c) => {
                        if (c.id !== conversation!.id) return c
                        return {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === assistantMessageId
                              ? { ...m, status: 'final' as const }
                              : m
                          ),
                          isRunning: false,
                          lastUpdatedAt: Date.now(),
                        }
                      })
                    )
                  }
                } catch (e) {
                  // Ignore parse errors for non-JSON lines
                }
              }
            }
          }
        }

        // Ensure final state
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversation!.id) return c
            return {
              ...c,
              isRunning: false,
              lastUpdatedAt: Date.now(),
            }
          })
        )
      } catch (error) {
        console.error('[useChat] Error sending message:', error)
        
        // Check if error is due to abort
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was cancelled, don't show error
          return
        }

        // Determine user-friendly error message
        let errorText = 'Failed to send message'
        if (error instanceof Error) {
          if (error.message.includes('API key')) {
            errorText = 'API key not configured. Please set ANTHROPIC_API_KEY in your environment.'
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorText = 'Network error. Please check your connection and try again.'
          } else if (error.message.includes('rate limit')) {
            errorText = 'Rate limit exceeded. Please wait a moment before trying again.'
          } else {
            errorText = error.message
          }
        }
        
        // Add error message
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: 'assistant',
          text: `Error: ${errorText}`,
          createdAt: Date.now(),
          status: 'final',
        }

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversation!.id) return c
            return {
              ...c,
              messages: [
                ...c.messages.filter((m) => m.status !== 'streaming'),
                errorMessage,
              ],
              isRunning: false,
              lastUpdatedAt: Date.now(),
            }
          })
        )
      }
    },
    [conversations, activeConversationId, createNewConversation, selectedIDs]
  )

  const onStopConversation = useCallback((conversationId: string) => {
    // Abort ongoing request
    const abortController = abortControllersRef.current.get(conversationId)
    if (abortController) {
      abortController.abort()
      abortControllersRef.current.delete(conversationId)
    }

    // Update conversation state
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c
        return {
          ...c,
          isRunning: false,
          messages: c.messages.map((m) =>
            m.status === 'streaming' ? { ...m, status: 'final' as const } : m
          ),
        }
      })
    )
  }, [])

  return {
    conversations,
    activeConversationId,
    onSelectConversation,
    onCreateConversation,
    onCloseConversation,
    onSendMessage,
    onStopConversation,
  }
}
