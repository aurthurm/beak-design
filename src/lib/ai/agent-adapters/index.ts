/**
 * Agent Adapter Interface
 * Common interface for all AI agent adapters (cloud, Ollama, CLI, MCP)
 */

import type { AgentConfig } from '../agent-config'

export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  system?: string
  tools?: any[]
  model?: string
}

export interface ChatDelta {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'done' | 'error'
  content?: string
  toolName?: string
  toolInput?: any
  toolResult?: any
  error?: string
}

/**
 * Agent Adapter Interface
 * All agent adapters must implement this interface
 */
export interface AgentAdapter {
  /** Adapter name */
  name: string

  /** Agent configuration */
  config: AgentConfig

  /** Stream chat responses */
  stream(request: ChatRequest): AsyncIterable<ChatDelta>

  /** Check if adapter supports tool calling */
  supportsTools(): boolean

  /** Get available models (if applicable) */
  getAvailableModels(): Promise<string[]>

  /** Check if adapter is available/connected */
  isAvailable(): Promise<boolean>
}

/**
 * Base adapter implementation with common functionality
 */
export abstract class BaseAgentAdapter implements AgentAdapter {
  abstract name: string
  abstract config: AgentConfig

  abstract stream(request: ChatRequest): AsyncIterable<ChatDelta>
  abstract supportsTools(): boolean
  abstract getAvailableModels(): Promise<string[]>
  abstract isAvailable(): Promise<boolean>

  /**
   * Convert adapter-specific response to ChatDelta format
   */
  protected createTextDelta(content: string): ChatDelta {
    return {
      type: 'text-delta',
      content,
    }
  }

  /**
   * Create tool call delta
   */
  protected createToolCall(name: string, input: any): ChatDelta {
    return {
      type: 'tool-call',
      toolName: name,
      toolInput: input,
    }
  }

  /**
   * Create tool result delta
   */
  protected createToolResult(name: string, result: any, isError = false): ChatDelta {
    return {
      type: 'tool-result',
      toolName: name,
      toolResult: result,
      error: isError ? String(result) : undefined,
    }
  }

  /**
   * Create done delta
   */
  protected createDone(): ChatDelta {
    return {
      type: 'done',
    }
  }

  /**
   * Create error delta
   */
  protected createError(error: string): ChatDelta {
    return {
      type: 'error',
      error,
    }
  }
}

/**
 * Get adapter instance for agent type
 */
export async function getAgentAdapter(
  type: string,
  config: AgentConfig
): Promise<AgentAdapter> {
  switch (type) {
    case 'cloud':
      const { CloudAgentAdapter } = await import('./cloud-adapter')
      return new CloudAgentAdapter(config)

    case 'ollama':
      const { OllamaAgentAdapter } = await import('./ollama-adapter')
      return new OllamaAgentAdapter(config)

    case 'cli':
      const { CLIAgentAdapter } = await import('./cli-adapter')
      return new CLIAgentAdapter(config)

    case 'mcp':
      const { MCPAgentAdapter } = await import('./mcp-adapter')
      return new MCPAgentAdapter(config)

    default:
      throw new Error(`Unknown agent type: ${type}`)
  }
}
