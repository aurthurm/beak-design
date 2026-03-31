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

export interface AgentAdapter {
  name: string
  config: AgentConfig
  stream(request: ChatRequest): AsyncIterable<ChatDelta>
  supportsTools(): boolean
  getAvailableModels(): Promise<string[]>
  isAvailable(): Promise<boolean>
}

export abstract class BaseAgentAdapter implements AgentAdapter {
  abstract name: string
  abstract config: AgentConfig
  abstract stream(request: ChatRequest): AsyncIterable<ChatDelta>
  abstract supportsTools(): boolean
  abstract getAvailableModels(): Promise<string[]>
  abstract isAvailable(): Promise<boolean>

  protected createTextDelta(content: string): ChatDelta {
    return { type: 'text-delta', content }
  }

  protected createToolCall(name: string, input: any): ChatDelta {
    return { type: 'tool-call', toolName: name, toolInput: input }
  }

  protected createToolResult(name: string, result: any, isError = false): ChatDelta {
    return {
      type: 'tool-result',
      toolName: name,
      toolResult: result,
      error: isError ? String(result) : undefined,
    }
  }

  protected createDone(): ChatDelta {
    return { type: 'done' }
  }

  protected createError(error: string): ChatDelta {
    return { type: 'error', error }
  }
}

export async function getAgentAdapter(type: string, config: AgentConfig): Promise<AgentAdapter> {
  switch (type) {
    case 'cloud': {
      const { CloudAgentAdapter } = await import('./cloud-adapter')
      return new CloudAgentAdapter(config)
    }
    case 'ollama': {
      const { OllamaAgentAdapter } = await import('./ollama-adapter')
      return new OllamaAgentAdapter(config)
    }
    case 'cli': {
      const { CLIAgentAdapter } = await import('./cli-adapter')
      return new CLIAgentAdapter(config)
    }
    default:
      throw new Error(`Unknown adapter type: ${type}`)
  }
}
