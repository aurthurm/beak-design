import { chat } from '@tanstack/ai'
import { createAnthropicChat } from '@tanstack/ai-anthropic'

import { BaseAgentAdapter } from './index'
import type { AgentConfig, ChatDelta, ChatRequest } from './index'

export class CloudAgentAdapter extends BaseAgentAdapter {
  name = 'Cloud (Anthropic)'
  config: AgentConfig

  constructor(config: AgentConfig) {
    super()
    this.config = config
  }

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return !!this.config?.metadata?.apiKey
    }
    return true
  }

  supportsTools(): boolean {
    return true
  }

  async getAvailableModels(): Promise<string[]> {
    return ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229']
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatDelta> {
    if (typeof window !== 'undefined') {
      yield this.createError('Cloud adapter should be used server-side only')
      return
    }

    const apiKey = this.config.metadata?.apiKey
    if (!apiKey) {
      yield this.createError('API key not configured')
      return
    }

    try {
      const model =
        (request.model as string | undefined) ||
        this.config.metadata?.model ||
        'claude-3-5-sonnet-20241022'
      const adapter = createAnthropicChat(model as Parameters<typeof createAnthropicChat>[0], apiKey)

      const stream = chat({
        adapter,
        messages: request.messages,
        tools: request.tools || [],
        systemPrompts: request.system ? [request.system] : undefined,
      })

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
