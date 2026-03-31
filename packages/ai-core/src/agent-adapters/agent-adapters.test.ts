import { describe, expect, it } from 'vitest'

import { getAgentAdapter } from './index'

describe('agent-adapters', () => {
  it('creates a cloud adapter', async () => {
    const adapter = await getAgentAdapter('cloud', {
      id: 'cloud-1',
      name: 'Cloud',
      type: 'cloud',
      enabled: true,
    } as never)

    expect(adapter.name).toContain('Cloud')
    expect(adapter.supportsTools()).toBe(true)
  })
})
