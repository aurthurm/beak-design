import { describe, expect, it } from 'vitest'

import type { Document, FrameId, LayerId, TokenId } from '../../schema/src'
import { applyDocumentMutation } from './document-mutations'

const actor = { kind: 'user' } as const
const now = '2026-01-01T00:00:00.000Z'

function createDocument(): Document {
  const pageId = 'page-1' as FrameId as never
  const frameId = 'frame-1' as FrameId
  const layerId = 'layer-1' as LayerId

  return {
    id: 'doc-1' as never,
    name: 'Doc',
    schemaVersion: '1.0.0',
    createdAt: now,
    updatedAt: now,
    activePageId: null,
    pages: {
      ['page-1' as never]: {
        id: 'page-1' as never,
        documentId: 'doc-1' as never,
        name: 'Page',
        frameIds: [frameId],
        provenance: {
          createdAt: now,
          createdBy: actor,
        },
      },
    },
    frames: {
      [frameId]: {
        id: frameId,
        pageId,
        name: 'Frame',
        platform: 'web',
        rect: { x: 0, y: 0, w: 200, h: 200 },
        childLayerIds: [layerId],
        provenance: {
          createdAt: now,
          createdBy: actor,
        },
      },
    },
    layers: {
      [layerId]: {
        id: layerId,
        type: 'rect',
        name: 'Layer',
        parentId: null,
        frameId,
        rect: { x: 0, y: 0, w: 20, h: 20 },
        provenance: {
          createdAt: now,
          createdBy: actor,
        },
      },
    },
    tokens: {},
    selection: {
      pageId: null,
      selectedIds: [],
    },
  }
}

describe('document mutations', () => {
  it('groups and ungroups layers', () => {
    const document = createDocument()
    const groupId = 'group-1' as LayerId

    const grouped = applyDocumentMutation(
      {
        type: 'layer.group',
        payload: {
          docId: document.id,
          groupId,
          layerIds: ['layer-1' as LayerId],
          name: 'Group',
        },
      },
      document,
      { actor, now }
    )

    expect(grouped.ok).toBe(true)
    if (!grouped.ok) throw new Error('expected grouped result')
    expect(grouped.document.layers[groupId]).toMatchObject({
      id: groupId,
      type: 'group',
      children: ['layer-1'],
      name: 'Group',
    })

    const ungrouped = applyDocumentMutation(
      {
        type: 'layer.ungroup',
        payload: {
          docId: document.id,
          groupId,
        },
      },
      grouped.document,
      { actor, now }
    )

    expect(ungrouped.ok).toBe(true)
    if (!ungrouped.ok) throw new Error('expected ungrouped result')
    expect(ungrouped.document.layers[groupId]).toBeUndefined()
  })

  it('reorders frame layers and rejects missing layers', () => {
    const document = createDocument()
    const frameId = 'frame-1' as FrameId
    const secondLayerId = 'layer-2' as LayerId

    document.frames[frameId] = {
      ...document.frames[frameId],
      childLayerIds: ['layer-1' as LayerId, secondLayerId],
    }
    document.layers[secondLayerId] = {
      id: secondLayerId,
      type: 'rect',
      name: 'Layer 2',
      parentId: null,
      frameId,
      rect: { x: 10, y: 10, w: 20, h: 20 },
      provenance: {
        createdAt: now,
        createdBy: actor,
      },
    }

    const reordered = applyDocumentMutation(
      {
        type: 'layer.reorder',
        payload: {
          docId: document.id,
          layerId: secondLayerId,
          toIndex: 0,
        },
      },
      document,
      { actor, now }
    )

    expect(reordered.ok).toBe(true)
    if (!reordered.ok) throw new Error('expected reordered result')
    expect(reordered.document.frames[frameId].childLayerIds).toEqual([secondLayerId, 'layer-1'])

    const missing = applyDocumentMutation(
      {
        type: 'layer.reorder',
        payload: {
          docId: document.id,
          layerId: 'missing' as LayerId,
          toIndex: 0,
        },
      },
      document,
      { actor, now }
    )

    expect(missing.ok).toBe(false)
    if (missing.ok) throw new Error('expected missing layer failure')
    expect(missing.error.code).toBe('NOT_FOUND')
  })

  it('upserts tokens', () => {
    const document = createDocument()
    const tokenId = 'token-1' as TokenId

    const result = applyDocumentMutation(
      {
        type: 'tokens.upsert',
        payload: {
          docId: document.id,
          tokens: [
            {
              id: tokenId,
              kind: 'color',
              name: 'Primary',
              value: { format: 'hex', hex: '#000000' },
            },
          ],
        },
      },
      document,
      { actor, now }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected token upsert result')
    expect(result.document.tokens[tokenId]).toMatchObject({
      id: tokenId,
      name: 'Primary',
    })
  })
})
