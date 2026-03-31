import type { FrameId, LayerId, Point, Rect, SelectionState, Frame, Layer } from '../../schema/src'
import type { ViewportTransform } from './viewport'

export function worldToScreen(point: Point, transform: ViewportTransform): Point {
  return transform.worldToScreen(point)
}

export function screenToWorld(point: Point, transform: ViewportTransform): Point {
  return transform.screenToWorld(point)
}

export function worldRectToScreen(rect: Rect, transform: ViewportTransform): Rect {
  return transform.worldRectToScreen(rect)
}

export function screenRectToWorld(rect: Rect, transform: ViewportTransform): Rect {
  return transform.screenRectToWorld(rect)
}

export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  }
}

export function snapRectToGrid(rect: Rect, gridSize: number): Rect {
  const snappedTopLeft = snapToGrid({ x: rect.x, y: rect.y }, gridSize)
  const snappedBottomRight = snapToGrid({ x: rect.x + rect.w, y: rect.y + rect.h }, gridSize)
  return {
    x: snappedTopLeft.x,
    y: snappedTopLeft.y,
    w: snappedBottomRight.x - snappedTopLeft.x,
    h: snappedBottomRight.y - snappedTopLeft.y,
  }
}

export function constrainPoint(point: Point, bounds: Rect): Point {
  return {
    x: Math.max(bounds.x, Math.min(bounds.x + bounds.w, point.x)),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.h, point.y)),
  }
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  )
}

export function rectsIntersect(rect1: Rect, rect2: Rect): boolean {
  return (
    rect1.x < rect2.x + rect2.w &&
    rect1.x + rect1.w > rect2.x &&
    rect1.y < rect2.y + rect2.h &&
    rect1.y + rect1.h > rect2.y
  )
}

export function unionRects(rect1: Rect, rect2: Rect): Rect {
  const minX = Math.min(rect1.x, rect2.x)
  const minY = Math.min(rect1.y, rect2.y)
  const maxX = Math.max(rect1.x + rect1.w, rect2.x + rect2.w)
  const maxY = Math.max(rect1.y + rect1.h, rect2.y + rect2.h)
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  }
}

export function snapPoint(
  point: Point,
  options: {
    gridSize?: number
    gridEnabled?: boolean
    threshold?: number
  }
): Point {
  const { gridSize = 20, gridEnabled = true, threshold = 5 } = options

  if (!gridEnabled) return point

  const snapped = snapToGrid(point, gridSize)
  const distance = Math.sqrt(Math.pow(snapped.x - point.x, 2) + Math.pow(snapped.y - point.y, 2))

  return distance <= threshold ? snapped : point
}

export function snapRect(
  rect: Rect,
  options: {
    gridSize?: number
    gridEnabled?: boolean
    threshold?: number
  }
): Rect {
  const { gridSize = 20, gridEnabled = true } = options

  if (!gridEnabled) return rect

  return snapRectToGrid(rect, gridSize)
}

export function calculateAlignmentGuides(
  movingRect: Rect,
  otherRects: Rect[],
  threshold: number = 5
): Array<{ axis: 'x' | 'y'; value: number; type: 'center' | 'edge' }> {
  const guides: Array<{ axis: 'x' | 'y'; value: number; type: 'center' | 'edge' }> = []

  const movingCenterX = movingRect.x + movingRect.w / 2
  const movingCenterY = movingRect.y + movingRect.h / 2
  const movingLeft = movingRect.x
  const movingRight = movingRect.x + movingRect.w
  const movingTop = movingRect.y
  const movingBottom = movingRect.y + movingRect.h

  for (const rect of otherRects) {
    const centerX = rect.x + rect.w / 2
    const centerY = rect.y + rect.h / 2
    const left = rect.x
    const right = rect.x + rect.w
    const top = rect.y
    const bottom = rect.y + rect.h

    if (Math.abs(movingCenterX - centerX) < threshold) {
      guides.push({ axis: 'x', value: centerX, type: 'center' })
    }
    if (Math.abs(movingCenterY - centerY) < threshold) {
      guides.push({ axis: 'y', value: centerY, type: 'center' })
    }

    if (Math.abs(movingLeft - left) < threshold) {
      guides.push({ axis: 'x', value: left, type: 'edge' })
    }
    if (Math.abs(movingRight - right) < threshold) {
      guides.push({ axis: 'x', value: right, type: 'edge' })
    }
    if (Math.abs(movingTop - top) < threshold) {
      guides.push({ axis: 'y', value: top, type: 'edge' })
    }
    if (Math.abs(movingBottom - bottom) < threshold) {
      guides.push({ axis: 'y', value: bottom, type: 'edge' })
    }
  }

  return guides
}

export function calculateSelectionBounds(
  selectedIds: Array<FrameId | LayerId>,
  document: { frames: Record<FrameId, Frame | undefined>; layers: Record<LayerId, Layer | undefined> }
): Rect | undefined {
  if (selectedIds.length === 0) return undefined

  const items = selectedIds
    .map((id) => document.frames[id as FrameId] ?? document.layers[id as LayerId] ?? null)
    .filter((item): item is Frame | Layer => item !== null)

  if (items.length === 0) return undefined

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const item of items) {
    if (item.rect) {
      minX = Math.min(minX, item.rect.x)
      minY = Math.min(minY, item.rect.y)
      maxX = Math.max(maxX, item.rect.x + item.rect.w)
      maxY = Math.max(maxY, item.rect.y + item.rect.h)
    }
  }

  if (minX === Infinity) return undefined

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  }
}
