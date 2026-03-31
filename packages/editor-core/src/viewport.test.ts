import { describe, expect, it } from 'vitest'

import { createViewportTransform } from './viewport'

describe('editor-core viewport', () => {
  it('converts between world and screen coordinates', () => {
    const viewport = createViewportTransform(10, 20, 2, 800, 600)

    expect(viewport.worldToScreen({ x: 5, y: 7 })).toEqual({ x: 30, y: 54 })
    expect(viewport.screenToWorld({ x: 30, y: 54 })).toEqual({ x: 5, y: 7 })
  })

  it('calculates visible world bounds', () => {
    const viewport = createViewportTransform(10, 20, 2, 800, 600)

    expect(viewport.getVisibleWorldBounds()).toEqual({ x: -10, y: -20, width: 400, height: 300 })
  })

  it('calculates zoom-to-fit and zoom-at-point transforms', () => {
    const viewport = createViewportTransform(0, 0, 1, 1000, 800)

    expect(viewport.zoomToFit({ x: 100, y: 50, w: 400, h: 200 }, 20)).toEqual({
      panX: -91.66666666666666,
      panY: 16.666666666666686,
      zoom: 2.4,
    })

    expect(viewport.zoomAtPoint(3, { x: 300, y: 200 })).toEqual({
      panX: -200,
      panY: -133.33333333333331,
      zoom: 3,
    })
  })
})
