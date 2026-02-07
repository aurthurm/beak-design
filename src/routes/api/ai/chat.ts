import { createFileRoute } from '@tanstack/react-router'
import { env } from '@/env'
import { buildMcpTools } from '@/lib/mcp-tools'
import { CanvasCommandBus } from '@/lib/ai/command-bus'
import { SimpleTransactionManager } from '@/lib/ai/transaction-manager'
import { getToolContextProvider } from '@/lib/ai/tool-context-provider'
import { getMcpToolsForAI } from '@/lib/ai/mcp-tool-adapters'
import { getAgentAdapter } from '@/lib/ai/agent-adapters'
import type { AgentConfig } from '@/lib/ai/agent-config'

/**
 * Get model from agent config or use default
 */
function getModelFromConfig(agentConfig?: AgentConfig): string {
  if (agentConfig?.metadata?.model) {
    return agentConfig.metadata.model
  }
  // Default model
  return 'claude-3-5-sonnet-20241022'
}

/**
 * Build system prompt with document context
 */
function buildSystemPrompt(selectedIDs: string[], documentContext?: {
  documentName?: string
  documentId?: string
  activePageId?: string
  frameCount?: number
  layerCount?: number
}): string {
  let prompt = `You are an AI design assistant helping users create and modify designs in a canvas-based design tool.

Available Tools:
- batch_design: Execute multiple design operations (Insert, Copy, Replace, Move, Delete, Update)
- search_design_nodes: Search for nodes in the document tree
- get_editor_state: Get current editor state
- document_tree: Get full document structure
- selection_state: Get current selection
- design_tokens: Get design tokens
- create_frame, update_frame, delete_frame: Frame operations
- create_layer, update_layer, delete_layer: Layer operations
- export_frame_png: Export frame as PNG

When modifying designs, use batch_design for multiple operations. Always use the active document context.

Current Context:
`

  if (documentContext) {
    if (documentContext.documentName) {
      prompt += `- Active Document: ${documentContext.documentName}${documentContext.documentId ? ` (${documentContext.documentId})` : ''}\n`
    }
    if (documentContext.activePageId) {
      prompt += `- Active Page: ${documentContext.activePageId}\n`
    }
    if (documentContext.frameCount !== undefined) {
      prompt += `- Total Frames: ${documentContext.frameCount}\n`
    }
    if (documentContext.layerCount !== undefined) {
      prompt += `- Total Layers: ${documentContext.layerCount}\n`
    }
  }

  if (selectedIDs.length > 0) {
    prompt += `- Selected Objects: ${selectedIDs.join(', ')}\n`
  }

  prompt += `
Instructions:
- Use batch_design for creating/modifying multiple elements at once
- Be concise and helpful
- When asked to create designs, use appropriate tools
- Always confirm what you're doing before making changes
`

  return prompt
}

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
            apiKey, // API key from client (localStorage)
          } = body

          // Initialize MCP tools
          const commandBus = new CanvasCommandBus()
          const txManager = new SimpleTransactionManager()
          const toolRegistry = buildMcpTools({
            commands: commandBus,
            tx: txManager,
          })

          // Get tool context provider
          const contextProvider = getToolContextProvider()
          
          // Get document context from request or use default
          // Note: In a real implementation, you'd pass document context from client
          let documentContext: {
            documentName?: string
            documentId?: string
            activePageId?: string
            frameCount?: number
            layerCount?: number
          } | undefined

          // Try to get document context from tool context
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

          // Convert MCP tools to TanStack AI tools
          const mcpTools = getMcpToolsForAI(toolRegistry)

          // Convert messages format
          const aiMessages = messages.map((msg: any) => {
            if (msg.role === 'user') {
              return { role: 'user' as const, content: msg.text || msg.content }
            }
            if (msg.role === 'assistant') {
              return {
                role: 'assistant' as const,
                content: msg.text || msg.content,
              }
            }
            return msg
          })

          // Build agent config
          let finalAgentConfig: AgentConfig
          if (agentConfig) {
            finalAgentConfig = agentConfig as AgentConfig
            // For cloud, ensure request apiKey is in config so adapter.isAvailable() and stream() see it
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
            // Default cloud config - use API key from request or env
            const apiKeyToUse = apiKey || env.ANTHROPIC_API_KEY
            if (!apiKeyToUse) {
              return Response.json(
                { error: 'API key not configured. Please set it in Settings > AI Assistant.' },
                { status: 500 }
              )
            }
            finalAgentConfig = {
              id: 'cloud-anthropic',
              name: 'Cloud',
              type: 'cloud',
              enabled: true,
              metadata: {
                apiKey: apiKeyToUse, // Pass API key in metadata
              },
            }
          } else {
            // For non-cloud agents, try to get from config or return error
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
                { status: 400 }
              )
            }
          }

          // Get agent adapter
          const adapter = await getAgentAdapter(agentType, finalAgentConfig)

          // Check if adapter is available
          const isAvailable = await adapter.isAvailable()
          if (!isAvailable) {
            return Response.json(
              { error: `Agent ${adapter.name} is not available` },
              { status: 503 }
            )
          }

          // Prepare chat request
          // Set DISABLE_AI_TOOLS=1 to bypass tools if chat hangs (for debugging)
          const toolsEnabled = !process.env.DISABLE_AI_TOOLS && adapter.supportsTools()
          const chatRequest = {
            messages: aiMessages,
            system: buildSystemPrompt(selectedIDs, documentContext),
            tools: toolsEnabled ? mcpTools : [],
            model: getModelFromConfig(finalAgentConfig),
          }

          // Stream from adapter
          const adapterStream = adapter.stream(chatRequest)

          // Normalize delta to format client expects (name/input/result vs toolName/toolInput/toolResult)
          function toClientDelta(delta: {
            type: string
            content?: string
            toolName?: string
            toolInput?: any
            toolResult?: any
            error?: string
          }) {
            if (delta.type === 'tool-call') {
              return { type: 'tool-call', name: delta.toolName, input: delta.toolInput }
            }
            if (delta.type === 'tool-result') {
              return { type: 'tool-result', name: delta.toolName, result: delta.toolResult, error: delta.error }
            }
            return delta
          }

          // Convert adapter stream to SSE format
          const encoder = new TextEncoder()
          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const delta of adapterStream) {
                  const clientDelta = toClientDelta(delta)
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

          // Handle specific error types
          let statusCode = 500
          let errorMessage = 'Failed to process chat request'
          let errorDetails: any = {}

          if (error instanceof Error) {
            // Network/connection errors
            if (error.message.includes('fetch') || error.message.includes('network')) {
              statusCode = 503
              errorMessage = 'Network error. Please check your connection.'
            }
            // API key errors
            else if (error.message.includes('API key') || error.message.includes('401')) {
              statusCode = 401
              errorMessage = 'Invalid API key. Please check your ANTHROPIC_API_KEY configuration.'
            }
            // Rate limit errors
            else if (error.message.includes('rate limit') || error.message.includes('429')) {
              statusCode = 429
              errorMessage = 'Rate limit exceeded. Please try again later.'
            }
            // Tool execution errors
            else if (error.message.includes('tool') || error.message.includes('MCP')) {
              statusCode = 500
              errorMessage = 'Tool execution error'
              errorDetails = { toolError: error.message }
            }
            else {
              errorMessage = error.message
            }
          }

          // Return error as SSE event for consistency
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
            },
          })
        }
      },
    },
  },
})
