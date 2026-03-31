import { describe, expect, it, vi } from 'vitest'

import { BatchDesignProcessor } from './batch-design-processor'
import type { CommandBus, ToolContext } from '../../tool-core/src'

describe('BatchDesignProcessor', () => {
  it('processes insert and update operations in one batch', async () => {
    const dispatch = vi.fn(async () => ({ ok: true as const }))
    const commandBus: CommandBus = { dispatch }

    const processor = new BatchDesignProcessor(commandBus)

    const ctx: ToolContext = {
      activeDocumentId: 'doc-1' as never,
      actor: { id: 'actor-1' } as never,
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
      storage: {
        createEmptyDocument: vi.fn(),
        loadDocument: vi.fn(),
        saveDocument: vi.fn(),
        listRecent: vi.fn(),
      } as never,
      editor: {
        getDocument: vi.fn(() => ({
          activePageId: 'page-1',
          pages: { 'page-1': { frameIds: ['frame-1'] } },
          frames: { 'frame-1': { id: 'frame-1' } },
          layers: {},
        })),
        setDocument: vi.fn(),
        getSelection: vi.fn(),
        setSelection: vi.fn(),
        exportFramePng: vi.fn(),
      } as never,
    }

    const result = await processor.process(
      ctx,
      false,
      [
        'box = I(document, { type: "rect", name: "Box", rect: { x: 1, y: 2, w: 3, h: 4 } })',
        'U(box, { name: "Updated Box" })',
      ].join('\n'),
      'batch-1'
    )

    expect(result).toEqual({
      success: true,
      message: expect.stringContaining('Successfully executed all operations'),
    })
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: 'layer.create',
      payload: {
        layerId: 'layer-1',
      },
    })
    expect(dispatch.mock.calls[1][0]).toMatchObject({
      type: 'layer.update',
      payload: {
        layerId: 'layer-1',
        patch: { name: 'Updated Box' },
      },
    })
  })

  it('returns a failure response when an operation errors', async () => {
    const dispatch = vi.fn(async () => ({ ok: false as const, error: { code: 'bad', message: 'nope' } }))
    const commandBus: CommandBus = { dispatch }
    const processor = new BatchDesignProcessor(commandBus)

    const ctx = {
      activeDocumentId: 'doc-1',
      actor: { id: 'actor-1' },
      ids: {
        layer: () => 'layer-1',
      },
      nowISO: () => '2026-03-30T00:00:00.000Z',
      storage: {},
      editor: {
        getDocument: () => ({
          activePageId: 'page-1',
          pages: { 'page-1': { frameIds: ['frame-1'] } },
          frames: { 'frame-1': { id: 'frame-1' } },
          layers: {},
        }),
      },
    } as never

    const result = await processor.process(ctx, false, 'I(document, { type: "rect" })', 'batch-2')

    expect(result?.success).toBe(false)
    expect(result?.message).toContain('Failed to execute')
    expect(dispatch).toHaveBeenCalledTimes(1)
  })
})
