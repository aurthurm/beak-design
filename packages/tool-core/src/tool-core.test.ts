import { describe, expect, it } from 'vitest'

import { ToolRegistry, requireActiveDocId, pickPatch } from './tool-core'

describe('tool-core', () => {
  it('registers and invokes tools', async () => {
    const registry = new ToolRegistry()
    registry.register({
      name: 'echo',
      description: 'Echo input',
      inputSchema: {},
      outputSchema: {},
      handler: async (input) => input,
    })

    expect(registry.getToolDefinitions()).toEqual([
      { name: 'echo', description: 'Echo input', inputSchema: {}, outputSchema: {} },
    ])
    await expect(registry.invoke('echo', { ok: true }, {} as never)).resolves.toEqual({ ok: true })
  })

  it('guards active document access', () => {
    expect(() => requireActiveDocId({ activeDocumentId: null } as never)).toThrow(
      'No active document. User must select an active document context.'
    )
  })

  it('picks safe patch keys only', () => {
    expect(pickPatch({ name: 'A', hidden: true, ignored: 1 }, ['name', 'hidden'] as const)).toEqual({
      name: 'A',
      hidden: true,
    })
  })
})
