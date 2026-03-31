import { describe, expect, it } from 'vitest'

import { normalizeChatDeltaForClient } from './chat-stream'

describe('chat-stream', () => {
  it('normalizes tool call and result deltas', () => {
    expect(
      normalizeChatDeltaForClient({
        type: 'tool-call',
        toolName: 'echo',
        toolInput: { value: 1 },
      })
    ).toEqual({
      type: 'tool-call',
      name: 'echo',
      input: { value: 1 },
    })

    expect(
      normalizeChatDeltaForClient({
        type: 'tool-result',
        toolName: 'echo',
        toolResult: { ok: true },
      })
    ).toEqual({
      type: 'tool-result',
      name: 'echo',
      result: { ok: true },
      error: undefined,
    })
  })
})
