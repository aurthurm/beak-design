/**
 * Cloud Agent Adapter (Anthropic Claude)
 * Wraps the existing TanStack AI Anthropic adapter
 */

import { BaseAgentAdapter } from './index'
import type { AgentConfig, ChatRequest, ChatDelta } from './index'
import { createAnthropicChat } from '@tanstack/ai-anthropic'
import { chat } from '@tanstack/ai'
import { env } from '@/env'

export class CloudAgentAdapter extends BaseAgentAdapter {
  name = 'Cloud (Anthropic)'
  config: AgentConfig

  constructor(config: AgentConfig) {
    super()
    this.config = config
  }

  async isAvailable(): Promise<boolean> {
    // Check if API key is available (env or from request/config)
    if (typeof window === 'undefined') {
      const fromEnv = !!env.ANTHROPIC_API_KEY
      const fromConfig = !!(this.config?.metadata?.apiKey)
      return fromEnv || fromConfig
    }
    // Client-side: assume available if configured
    return true
  }

  supportsTools(): boolean {
    return true
  }

  async getAvailableModels(): Promise<string[]> {
    return [
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
    ]
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatDelta> {
    if (typeof window !== 'undefined') {
      // Client-side: should not be called directly
      yield this.createError('Cloud adapter should be used server-side only')
      return
    }

    // Server-side: use API key from config metadata or env
    const apiKey = this.config.metadata?.apiKey || env.ANTHROPIC_API_KEY
    if (!apiKey) {
      yield this.createError('API key not configured')
      return
    }

    try {
      const model =
        (request.model as string | undefined) ||
        this.config.metadata?.model ||
        'claude-3-5-sonnet-20241022'
      const adapter = createAnthropicChat(
        model as Parameters<typeof createAnthropicChat>[0],
        apiKey
      )

      const stream = chat({
        adapter,
        messages: request.messages,
        tools: request.tools || [],
        systemPrompts: request.system ? [request.system] : undefined,
      })

      // Track tool calls to map toolCallId to tool name
      const toolCallMap = new Map<string, string>()

      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          yield this.createTextDelta(chunk.delta)
        } else if (chunk.type === 'tool_call') {
          const toolName = chunk.toolCall.function.name
          toolCallMap.set(chunk.id, toolName)
          let toolInput: any
          try {
            toolInput = JSON.parse(chunk.toolCall.function.arguments)
          } catch {
            toolInput = chunk.toolCall.function.arguments
          }
          yield this.createToolCall(toolName, toolInput)
        } else if (chunk.type === 'tool_result') {
          const toolName = toolCallMap.get(chunk.toolCallId) || chunk.toolCallId
          yield this.createToolResult(toolName, chunk.content, false)
        } else if (chunk.type === 'done') {
          yield this.createDone()
          return
        }
      }
    } catch (error) {
      yield this.createError(
        `Cloud adapter error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
