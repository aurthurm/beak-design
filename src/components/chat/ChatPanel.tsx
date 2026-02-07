import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowUp,
  Bot,
  X,
  Loader2,
  Plus,
  Wrench,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentConfig } from '@/lib/ai/agent-config'
import { getDefaultAgentId, getAgentConfig } from '@/lib/ai/agent-config'

// Tool message component with expandable details
function ToolMessage({ message }: { message: ChatMessage }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!message.toolUse) return null

  const hasOutput = message.toolUse.output !== undefined
  const isError = message.toolUse.isError

  return (
    <div
      className={cn(
        'mr-auto bg-muted max-w-[80%] rounded-lg p-2 text-sm border',
        isError && 'border-destructive'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {isError ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : hasOutput ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <Wrench className="h-4 w-4 text-muted-foreground animate-spin" />
        )}
        <span className="font-medium text-xs">{message.toolUse.name}</span>
        {hasOutput && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {message.text && <div className="text-xs mb-1">{message.text}</div>}
      {isExpanded && (
        <div className="mt-2 space-y-2 text-xs">
          {message.toolUse.input && (
            <div>
              <div className="font-medium mb-1">Input:</div>
              <pre className="bg-background p-2 rounded overflow-x-auto">
                {JSON.stringify(message.toolUse.input, null, 2)}
              </pre>
            </div>
          )}
          {hasOutput && (
            <div>
              <div className="font-medium mb-1">{isError ? 'Error' : 'Output'}:</div>
              <pre
                className={cn(
                  'p-2 rounded overflow-x-auto',
                  isError ? 'bg-destructive/10 text-destructive' : 'bg-background'
                )}
              >
                {JSON.stringify(message.toolUse.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  text: string
  createdAt: number
  status?: 'streaming' | 'final'
  toolUse?: {
    name: string
    input: any
    output?: any
    isError?: boolean
  }
}

export interface ConversationTab {
  id: string
  title: string
  agentType?: string
  agentConfig?: AgentConfig
  messages: ChatMessage[]
  isRunning: boolean
  lastUpdatedAt: number
}

interface ChatPanelProps {
  selectedIDs: string[]
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

const PANEL_WIDTH = 380
const PANEL_HEIGHT = 420

export function ChatPanel({
  selectedIDs,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onCloseConversation,
  onSendMessage,
  onStopConversation,
}: ChatPanelProps) {
  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  
  // Get agent config from conversation or use default from settings
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(
    activeConversation?.agentConfig || null
  )
  // Load default agent config (Cloud Anthropic only for now) if conversation doesn't have one
  useEffect(() => {
    if (!activeConversationId) {
      return
    }

    if (activeConversation?.agentConfig) {
      setAgentConfig(activeConversation.agentConfig)
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const defaultId = getDefaultAgentId()
    if (defaultId) {
      const config = getAgentConfig(defaultId)
      if (config) {
        setAgentConfig(config)
      }
    }
  }, [activeConversationId, activeConversation?.agentConfig])

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputHasText, setInputHasText] = useState(false)
  const hasMessages = activeConversation && activeConversation.messages.length > 0

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages.length])

  const handleSubmit = useCallback(() => {
    const text = inputRef.current?.value.trim()
    if (text && activeConversationId) {
      // Use agent config from conversation or default
      const agentConfigToUse = agentConfig || activeConversation?.agentConfig
      onSendMessage({
        prompt: text,
        conversationId: activeConversationId,
        agentConfig: agentConfigToUse,
        agentType: agentConfigToUse?.type || activeConversation?.agentType || 'cloud',
      })
      if (inputRef.current) {
        inputRef.current.value = ''
        inputRef.current.style.height = 'auto'
      }
      setInputHasText(false)
    }
  }, [activeConversationId, onSendMessage, activeConversation, agentConfig])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const adjustTextareaHeight = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    setInputHasText(textarea.value.trim().length > 0)
  }, [])

  // Collapsed state
  if (!isExpanded) {
    return (
      <div className="absolute bottom-4 left-4 z-40 w-[200px] rounded-lg border bg-background shadow-lg p-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(true)}
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <input
            type="text"
            className="flex-1 border-none bg-transparent text-sm outline-none"
            placeholder="Design with AI..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsExpanded(true)
                inputRef.current?.focus()
              }
            }}
          />
        </div>
      </div>
    )
  }

  // Expanded state - chat only (no historical chats sidebar)
  return (
    <div
      className="absolute bottom-4 left-4 z-40 flex rounded-lg border bg-background shadow-none overflow-hidden"
      style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
    >
      {/* Chat Panel */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="border-b p-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">AI Assistant</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onCreateConversation}
            >
              <Plus className="h-3 w-3 mr-1" />
              New Chat
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {hasMessages ? (
            <div className="flex flex-col gap-3">
              {activeConversation?.messages.map((message) => {
                if (message.role === 'tool' && message.toolUse) {
                  return <ToolMessage key={message.id} message={message} />
                }

                return (
                  <div
                    key={message.id}
                    className={cn(
                      'rounded-lg p-3 text-sm max-w-[85%]',
                      message.role === 'user'
                        ? 'ml-auto bg-primary text-primary-foreground'
                        : 'mr-auto bg-muted'
                    )}
                  >
                    <div className="whitespace-pre-wrap">{message.text}</div>
                    {message.status === 'streaming' && (
                      <Loader2 className="mt-2 h-3 w-3 animate-spin" />
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Bot className="w-12 h-12" />
              <p className="text-sm font-medium">Start a conversation</p>
              <p className="text-xs">Ask me to help you design something</p>
            </div>
          )}
        </ScrollArea>

        {/* Model display — Cloud Anthropic only for now */}
        <div className="border-t px-3 py-2 flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-semibold whitespace-nowrap">Model</span>
          <span className="flex-1 min-w-0 truncate">
            {agentConfig?.metadata?.model === 'claude-3-5-haiku-20241022'
              ? 'Claude 3.5 Haiku'
              : agentConfig?.metadata?.model === 'claude-3-opus-20240229'
                ? 'Claude 3 Opus'
                : 'Claude 3.5 Sonnet'}
            {' (Cloud)'}
          </span>
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              onChange={adjustTextareaHeight}
              onKeyDown={handleKeyDown}
              className="min-h-[48px] max-h-[120px] resize-none flex-1 shadow-none focus-visible:ring-0"
              placeholder="Design with AI..."
            />
            {activeConversation?.isRunning ? (
              <Button
                variant="destructive"
                size="icon"
                className="h-10 w-10"
                onClick={() => onStopConversation(activeConversationId)}
              >
                <X className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10"
                onClick={handleSubmit}
                disabled={!inputHasText}
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
            )}
          </div>
          {selectedIDs.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              {selectedIDs.length} object{selectedIDs.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
