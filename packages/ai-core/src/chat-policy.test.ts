import { describe, expect, it } from 'vitest'

import { buildSystemPrompt, getModelFromConfig, normalizeChatMessages } from './chat-policy'

describe('chat-policy', () => {
  it('selects a configured model before the default', () => {
    expect(getModelFromConfig({ metadata: { model: 'custom-model' } } as never)).toBe(
      'custom-model'
    )
    expect(getModelFromConfig(undefined)).toBe('claude-3-5-sonnet-20241022')
  })

  it('builds a prompt with selected ids and document context', () => {
    const prompt = buildSystemPrompt(['layer-1', 'layer-2'], {
      documentName: 'Demo',
      documentId: 'doc-1',
      activePageId: 'page-1',
      frameCount: 3,
      layerCount: 7,
    })

    expect(prompt).toContain('Active Document: Demo (doc-1)')
    expect(prompt).toContain('Active Page: page-1')
    expect(prompt).toContain('Total Frames: 3')
    expect(prompt).toContain('Total Layers: 7')
    expect(prompt).toContain('Selected Objects: layer-1, layer-2')
  })

  it('normalizes chat messages to content strings', () => {
    expect(
      normalizeChatMessages([
        { role: 'user', text: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'tool', content: 'ignored' } as never,
      ])
    ).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
      { role: 'assistant', content: 'ignored' },
    ])
  })
})
