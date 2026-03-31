import { describe, expect, it } from 'vitest'

import { type FrameId, type LayerId, type Rect } from '../../schema/src'
import { createViewportTransform } from './viewport'
import {
  calculateAlignmentGuides,
  calculateSelectionBounds,
  constrainPoint,
  pointInRect,
  rectsIntersect,
  screenRectToWorld,
  screenToWorld,
  snapPoint,
  snapRect,
  snapRectToGrid,
  snapToGrid,
  unionRects,
  worldRectToScreen,
  worldToScreen,
} from './geometry'

describe('editor-core geometry', () => {
  it('transforms coordinates through the viewport', () => {
    const viewport = createViewportTransform(10, 20, 2, 800, 600)
    expect(worldToScreen({ x: 5, y: 7 }, viewport)).toEqual({ x: 30, y: 54 })
    expect(screenToWorld({ x: 30, y: 54 }, viewport)).toEqual({ x: 5, y: 7 })
    expect(worldRectToScreen({ x: 1, y: 2, w: 3, h: 4 }, viewport)).toEqual({ x: 22, y: 44, w: 6, h: 8 })
    expect(screenRectToWorld({ x: 22, y: 44, w: 6, h: 8 }, viewport)).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  })

  it('snaps and constrains geometry', () => {
    expect(snapToGrid({ x: 13, y: 27 }, 10)).toEqual({ x: 10, y: 30 })
    expect(snapRectToGrid({ x: 13, y: 27, w: 15, h: 19 }, 10)).toEqual({ x: 10, y: 30, w: 20, h: 20 })
    expect(snapPoint({ x: 12, y: 12 }, { gridSize: 10, threshold: 3 })).toEqual({ x: 10, y: 10 })
    expect(snapRect({ x: 13, y: 27, w: 15, h: 19 }, { gridSize: 10 })).toEqual({ x: 10, y: 30, w: 20, h: 20 })
    expect(constrainPoint({ x: 5, y: 50 }, { x: 10, y: 20, w: 100, h: 100 })).toEqual({ x: 10, y: 50 })
  })

  it('computes intersections, unions, guides, and selection bounds', () => {
    expect(pointInRect({ x: 5, y: 5 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(true)
    expect(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 8, y: 8, w: 10, h: 10 })).toBe(true)
    expect(unionRects({ x: 0, y: 0, w: 10, h: 10 }, { x: 8, y: 8, w: 10, h: 10 })).toEqual({ x: 0, y: 0, w: 18, h: 18 })
    expect(calculateAlignmentGuides({ x: 100, y: 100, w: 50, h: 50 }, [{ x: 100, y: 90, w: 50, h: 50 }])).toEqual([
      { axis: 'x', value: 125, type: 'center' },
      { axis: 'x', value: 100, type: 'edge' },
      { axis: 'x', value: 150, type: 'edge' },
    ])

    const pageId = 'page-1'
    const frameId = 'frame-1' as FrameId
    const layerId = 'layer-1' as LayerId
    const bounds = calculateSelectionBounds([frameId, layerId], {
      frames: {
        [frameId]: {
          id: frameId,
          pageId: pageId as never,
          name: 'Frame',
          platform: 'web',
          rect: { x: 10, y: 20, w: 100, h: 80 },
          childLayerIds: [],
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
          name: 'Layer',
          parentId: frameId,
          frameId,
          rect: { x: 5, y: 15, w: 20, h: 20 },
          provenance: {
            createdAt: '2026-01-01T00:00:00.000Z',
            createdBy: { kind: 'user' },
          },
        },
      },
    })

    expect(bounds).toEqual({ x: 5, y: 15, w: 105, h: 85 })
  })
})
