import { describe, expect, it } from 'vitest'

import {
  SCHEMA_VERSION,
  type Document,
  type FrameId,
  type LayerId,
  type PageId,
  type Rect,
  type SelectionState,
} from './index'

describe('schema package', () => {
  it('exports the schema version used across the app', () => {
    expect(SCHEMA_VERSION).toBe('1.0.0')
  })

  it('supports the core document shape', () => {
    const pageId = 'page-1' as PageId
    const frameId = 'frame-1' as FrameId
    const layerId = 'layer-1' as LayerId
    const rect: Rect = { x: 10, y: 20, w: 300, h: 200 }

    const doc: Document = {
      id: 'doc-1' as never,
      schemaVersion: SCHEMA_VERSION,
      name: 'Test Doc',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      activePageId: pageId,
      pages: {
        [pageId]: {
          id: pageId,
          documentId: 'doc-1' as never,
          name: 'Page 1',
          frameIds: [frameId],
          provenance: {
            createdAt: '2026-01-01T00:00:00.000Z',
            createdBy: { kind: 'user' },
          },
        },
      },
      frames: {
        [frameId]: {
          id: frameId,
          pageId,
          name: 'Frame 1',
          platform: 'web',
          rect,
          childLayerIds: [layerId],
          provenance: {
            createdAt: '2026-01-01T00:00:00.000Z',
            createdBy: { kind: 'user' },
          },
        },
      },
      layers: {
        [layerId]: {
          id: layerId,
          type: 'rect',
          name: 'Layer 1',
          parentId: frameId,
          frameId,
          rect,
          provenance: {
            createdAt: '2026-01-01T00:00:00.000Z',
            createdBy: { kind: 'user' },
          },
        },
      },
      components: {},
      tokens: {},
      assets: {},
    }

    expect(doc.pages[pageId].frameIds).toEqual([frameId])
    expect(doc.frames[frameId].childLayerIds).toEqual([layerId])
    expect(doc.layers[layerId].type).toBe('rect')
  })

  it('supports selection state', () => {
    const selection: SelectionState = {
      pageId: 'page-1' as PageId,
      selectedIds: ['frame-1' as FrameId, 'layer-1' as LayerId],
      bounds: { x: 0, y: 0, w: 100, h: 100 },
    }

    expect(selection.selectedIds).toHaveLength(2)
    expect(selection.bounds?.w).toBe(100)
  })
})
