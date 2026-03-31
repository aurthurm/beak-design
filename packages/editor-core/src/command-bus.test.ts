import { describe, expect, it, vi } from 'vitest'
import { CanvasCommandBus } from './command-bus'

function createCtx() {
  const document = {
    id: 'doc-1',
    name: 'Doc',
    schemaVersion: '1.0.0',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    activePageId: null,
    pages: {},
    frames: {},
    layers: {},
    tokens: {},
    selection: { pageId: 'page-1', selectedIds: [] },
  } as const

  const storage = {
    createEmptyDocument: vi.fn(({ name, docId, now }) => ({
      ...document,
      id: docId,
      name,
      createdAt: now,
      updatedAt: now,
    })),
    loadDocument: vi.fn(async () => document),
    saveDocument: vi.fn(async () => undefined),
    listRecent: vi.fn(async () => []),
  }

  const editor = {
    getDocument: vi.fn(() => null),
    setDocument: vi.fn(),
    getSelection: vi.fn(() => document.selection),
    setSelection: vi.fn(),
    exportFramePng: vi.fn(),
  }

  return {
    activeDocumentId: 'doc-1',
    actor: 'user-1',
    storage,
    editor,
    ids: {
      doc: vi.fn(() => 'doc-2'),
      page: vi.fn(() => 'page-2'),
      frame: vi.fn(() => 'frame-2'),
      layer: vi.fn(() => 'layer-2'),
      component: vi.fn(() => 'component-2'),
      token: vi.fn(() => 'token-2'),
      transaction: vi.fn(() => 'tx-2'),
    },
    nowISO: () => '2026-01-01T00:00:00.000Z',
  } as const
}

describe('CanvasCommandBus', () => {
  it('creates a document via storage and updates editor state', async () => {
    const ctx = createCtx()
    const bus = new CanvasCommandBus()

    const result = await bus.dispatch(
      { type: 'doc.create', payload: { name: 'New Doc', docId: 'doc-2' } },
      ctx as never
    )

    expect(result.ok).toBe(true)
    expect(ctx.storage.createEmptyDocument).toHaveBeenCalledWith({
      name: 'New Doc',
      docId: 'doc-2',
      now: '2026-01-01T00:00:00.000Z',
    })
    expect(ctx.editor.setDocument).toHaveBeenCalled()
    expect(ctx.storage.saveDocument).toHaveBeenCalled()
  })

  it('creates a page in the active document', async () => {
    const ctx = createCtx()
    const bus = new CanvasCommandBus()

    const result = await bus.dispatch(
      { type: 'page.create', payload: { docId: 'doc-1', pageId: 'page-2', name: 'Page 2' } },
      ctx as never
    )

    expect(result.ok).toBe(true)
    expect(ctx.editor.setDocument).toHaveBeenCalled()
    expect(ctx.storage.saveDocument).toHaveBeenCalled()
  })
})
