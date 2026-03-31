import { describe, expect, it, vi } from 'vitest'

import { ToolContextProvider } from './tool-context-provider'

describe('ToolContextProvider', () => {
  it('builds a tool context from injected dependencies', async () => {
    const provider = new ToolContextProvider({
      ids: {
        doc: () => 'doc-2' as never,
        page: () => 'page-1' as never,
        frame: () => 'frame-1' as never,
        layer: () => 'layer-1' as never,
        component: () => 'component-1' as never,
        token: () => 'token-1' as never,
        transaction: () => 'tx-1' as never,
      } as never,
      nowISO: () => '2026-03-30T00:00:00.000Z',
      createEmptyDocument: vi.fn((input) => ({ id: input.docId, name: input.name } as never)),
      loadDocument: vi.fn(async () => ({ id: 'doc-1', name: 'Loaded' } as never)),
      saveDocument: vi.fn(async () => undefined),
      listRecent: vi.fn(async () => [{ id: 'doc-1', name: 'Loaded', updatedAt: 'now' }]),
      getCanvasDocument: vi.fn(() => ({ id: 'doc-1', name: 'Canvas' } as never)),
      setCanvasDocument: vi.fn(),
      getCanvasSelection: vi.fn(() => ({ pageId: null, selectedIds: [] })),
      setCanvasSelection: vi.fn(),
      exportFramePng: vi.fn(async () => ({ mimeType: 'image/png', bytesBase64: 'abc' })),
    })

    provider.setActiveDocumentId('doc-1' as never)
    const ctx = provider.createToolContext()

    expect(ctx.activeDocumentId).toBe('doc-1')
    expect(ctx.editor.getDocument('doc-1' as never)).toEqual({ id: 'doc-1', name: 'Canvas' })
    expect(ctx.editor.getSelection()).toEqual({ pageId: null, selectedIds: [] })
    await expect(ctx.storage.loadDocument('doc-1' as never)).resolves.toEqual({
      id: 'doc-1',
      name: 'Loaded',
    })
  })
})
