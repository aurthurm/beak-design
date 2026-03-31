import { afterEach, describe, expect, it, vi } from 'vitest'

import { SCHEMA_VERSION, type Document, type FrameId, type LayerId, type PageId } from '../../schema/src'
import { deserializeBeaki, serializeBeaki } from './file-format'

afterEach(() => {
  vi.useRealTimers()
})

describe('storage-core beaki format', () => {
  it('serializes and deserializes a document round-trip', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-03T04:05:06.000Z'))

    const pageId = 'page-1' as PageId
    const frameId = 'frame-1' as FrameId
    const layerId = 'layer-1' as LayerId
    const document: Document = {
      id: 'doc-1' as never,
      schemaVersion: SCHEMA_VERSION,
      name: 'Round Trip',
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
          rect: { x: 0, y: 0, w: 640, h: 480 },
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
          rect: { x: 1, y: 2, w: 3, h: 4 },
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

    const serialized = serializeBeaki(document)
    const parsed = deserializeBeaki(serialized)

    expect(parsed._format).toBe('beaki-v1')
    expect(parsed.version).toBe(SCHEMA_VERSION)
    expect(parsed.document.updatedAt).toBe('2026-02-03T04:05:06.000Z')
    expect(parsed.document.pages[pageId].frameIds).toEqual([frameId])
    expect(parsed.document.frames[frameId].childLayerIds).toEqual([layerId])
  })

  it('rejects unsupported file formats', () => {
    expect(() => deserializeBeaki(JSON.stringify({ _format: 'old', document: {} }))).toThrow(
      'Invalid file format. Expected beaki-v1 format.'
    )
  })
})
