export type ChatDelta = {
  type: string
  content?: string
  toolName?: string
  toolInput?: any
  toolResult?: any
  error?: string
}

export type ClientDelta =
  | {
      type: 'text-delta' | 'done' | 'error'
      content?: string
      error?: string
    }
  | {
      type: 'tool-call'
      name?: string
      input?: any
    }
  | {
      type: 'tool-result'
      name?: string
      result?: any
      error?: string
    }

export function normalizeChatDeltaForClient(delta: ChatDelta): ClientDelta {
  if (delta.type === 'tool-call') {
    return { type: 'tool-call', name: delta.toolName, input: delta.toolInput }
  }

  if (delta.type === 'tool-result') {
    return {
      type: 'tool-result',
      name: delta.toolName,
      result: delta.toolResult,
      error: delta.error,
    }
  }

  if (delta.type === 'error') {
    return { type: 'error', error: delta.error }
  }

  return { type: delta.type as 'text-delta' | 'done' | 'error', content: delta.content, error: delta.error }
}
