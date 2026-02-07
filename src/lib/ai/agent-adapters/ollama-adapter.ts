/**
 * Ollama Agent Adapter
 * Connects to local Ollama server using @tanstack/ai-ollama
 */

import { BaseAgentAdapter } from './index'
import type { AgentConfig, ChatRequest, ChatDelta } from './index'
import { ollamaText } from '@tanstack/ai-ollama'
import { chat } from '@tanstack/ai'

export class OllamaAgentAdapter extends BaseAgentAdapter {
  name = 'Ollama'
  config: AgentConfig

  constructor(config: AgentConfig) {
    super()
    this.config = config
  }

  async isAvailable(): Promise<boolean> {
    try {
      const endpoint = this.config.endpoint || 'http://localhost:11434'
      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  supportsTools(): boolean {
    // Ollama supports tool calling with some models
    return true
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const endpoint = this.config.endpoint || 'http://localhost:11434'
      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      })

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return data.models?.map((m: any) => m.name) || []
    } catch {
      return []
    }
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatDelta> {
    if (typeof window !== 'undefined') {
      // Client-side: proxy through API
      yield this.createError('Ollama adapter should be used server-side only')
      return
    }

    try {
      const endpoint = this.config.endpoint || 'http://localhost:11434'
      const model = request.model || this.config.model || 'llama3.2'

      // Check availability first
      const available = await this.isAvailable()
      if (!available) {
        yield this.createError(
          `Ollama server not available at ${endpoint}. Make sure Ollama is running.`
        )
        return
      }

      const adapter = ollamaText({
        baseURL: endpoint,
        model,
      })

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
        `Ollama error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
