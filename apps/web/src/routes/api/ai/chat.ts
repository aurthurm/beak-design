import { createFileRoute } from '@tanstack/react-router'
import type { AgentConfig } from '@/lib/ai/agent-config'
import { CanvasCommandBus } from '@/lib/ai/command-bus'
import { getAgentAdapter } from '@/lib/ai/agent-adapters'
import {
  buildSystemPrompt,
  getModelFromConfig,
  normalizeChatMessages,
} from '@/lib/ai/chat-policy'
import { normalizeChatDeltaForClient } from '@/lib/ai/chat-stream'
import { getMcpToolsForAI } from '@/lib/ai/mcp-tool-adapters'
import { SimpleTransactionManager } from '@/lib/ai/transaction-manager'
import { getToolContextProvider } from '@/lib/ai/tool-context-provider'
import { buildMcpTools } from '@/lib/mcp-tools'
import { env } from '@/env'

export const Route = createFileRoute('/api/ai/chat')({
  component: () => null,
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const {
            messages,
            selectedIDs = [],
            conversationId,
            agentType = 'cloud',
            agentConfig,
            apiKey,
          } = body

          void conversationId

          const commandBus = new CanvasCommandBus()
          const txManager = new SimpleTransactionManager()
          const toolRegistry = buildMcpTools({
            commands: commandBus,
            tx: txManager,
          })

          const contextProvider = getToolContextProvider()
          let documentContext:
            | {
                documentName?: string
                documentId?: string
                activePageId?: string
                frameCount?: number
                layerCount?: number
              }
            | undefined

          const toolContext = contextProvider.createToolContext()
          if (toolContext.activeDocumentId) {
            const doc = toolContext.editor.getDocument(toolContext.activeDocumentId)
            if (doc) {
              documentContext = {
                documentName: doc.name,
                documentId: doc.id,
                activePageId: doc.activePageId || undefined,
                frameCount: Object.keys(doc.frames).length,
                layerCount: Object.keys(doc.layers).length,
              }
            }
          }

          const mcpTools = getMcpToolsForAI(toolRegistry)
          const aiMessages = normalizeChatMessages(messages)

          let finalAgentConfig: AgentConfig
          if (agentConfig) {
            finalAgentConfig = agentConfig as AgentConfig
            if (agentType === 'cloud' && apiKey) {
              finalAgentConfig = {
                ...finalAgentConfig,
                metadata: {
                  ...(finalAgentConfig.metadata || {}),
                  apiKey,
                },
              }
            }
          } else if (agentType === 'cloud') {
            const apiKeyToUse = apiKey || env.ANTHROPIC_API_KEY
            if (!apiKeyToUse) {
              return Response.json(
                { error: 'API key not configured. Please set it in Settings > AI Assistant.' },
                { status: 500 },
              )
            }
            finalAgentConfig = {
              id: 'cloud-anthropic',
              name: 'Cloud',
              type: 'cloud',
              enabled: true,
              metadata: {
                apiKey: apiKeyToUse,
              },
            }
          } else {
            if (agentType === 'ollama') {
              finalAgentConfig = {
                id: 'ollama-local',
                name: 'Ollama (Local)',
                type: 'ollama',
                endpoint: 'http://localhost:11434',
                enabled: true,
              }
            } else {
              return Response.json(
                { error: `Agent config required for ${agentType} agent` },
                { status: 400 },
              )
            }
          }

          const adapter = await getAgentAdapter(agentType, finalAgentConfig)
          const isAvailable = await adapter.isAvailable()
          if (!isAvailable) {
            return Response.json(
              { error: `Agent ${adapter.name} is not available` },
              { status: 503 },
            )
          }

          const toolsEnabled = !process.env.DISABLE_AI_TOOLS && adapter.supportsTools()
          const chatRequest = {
            messages: aiMessages,
            system: buildSystemPrompt(selectedIDs, documentContext),
            tools: toolsEnabled ? mcpTools : [],
            model: getModelFromConfig(finalAgentConfig),
          }

          const adapterStream = adapter.stream(chatRequest)
          const encoder = new TextEncoder()
          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const delta of adapterStream) {
                  const clientDelta = normalizeChatDeltaForClient(delta)
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(clientDelta)}\n\n`))
                }
                controller.close()
              } catch (error) {
                console.error('[AI Chat API] Stream error:', error)
                const errorDelta = {
                  type: 'error',
                  error: error instanceof Error ? error.message : String(error),
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorDelta)}\n\n`))
                controller.close()
              }
            },
          })

          return new Response(readable, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          })
        } catch (error) {
          console.error('[AI Chat API] Error:', error)

          let statusCode = 500
          let errorMessage = 'Failed to process chat request'
          let errorDetails: any = {}

          if (error instanceof Error) {
            if (error.message.includes('fetch') || error.message.includes('network')) {
              statusCode = 503
              errorMessage = 'Network error. Please check your connection.'
            } else if (error.message.includes('API key') || error.message.includes('401')) {
              statusCode = 401
              errorMessage = 'Invalid API key. Please check your ANTHROPIC_API_KEY configuration.'
            } else if (error.message.includes('rate limit') || error.message.includes('429')) {
              statusCode = 429
              errorMessage = 'Rate limit exceeded. Please try again later.'
            } else if (error.message.includes('tool') || error.message.includes('MCP')) {
              statusCode = 500
              errorMessage = 'Tool execution error'
              errorDetails = { toolError: error.message }
            } else {
              errorMessage = error.message
            }
          }

          const errorEvent = `data: ${JSON.stringify({
            type: 'error',
            error: errorMessage,
            details: errorDetails,
          })}\n\n`

          return new Response(errorEvent, {
            status: statusCode,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          })
        }
      },
    },
  },
})
