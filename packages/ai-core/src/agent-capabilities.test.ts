import { describe, expect, it } from 'vitest'

import { getAgentCapabilitySummary } from './agent-capabilities'

describe('agent-capabilities', () => {
  it('summarizes agent capabilities by type', () => {
    expect(
      getAgentCapabilitySummary({
        id: 'cloud-1',
        name: 'Cloud',
        type: 'cloud',
        enabled: true,
      } as never)
    ).toEqual({
      id: 'cloud-1',
      name: 'Cloud',
      type: 'cloud',
      supportsTools: true,
      streaming: true,
      transport: 'cloud',
    })

    expect(
      getAgentCapabilitySummary({
        id: 'cli-1',
        name: 'CLI',
        type: 'cli',
        enabled: true,
      } as never)
    ).toMatchObject({
      supportsTools: false,
      transport: 'stdio',
    })
  })
})
