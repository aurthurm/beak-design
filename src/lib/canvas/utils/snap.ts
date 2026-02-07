import type { Point, Rect } from '../../schema'
import { snapToGrid, snapRectToGrid } from './coordinates'

/**
 * Snap utilities for grid and guides
 */
export function snapPoint(point: Point, options: {
  gridSize?: number
  gridEnabled?: boolean
  threshold?: number
}): Point {
  const { gridSize = 20, gridEnabled = true, threshold = 5 } = options

  if (!gridEnabled) return point

  const snapped = snapToGrid(point, gridSize)
  const distance = Math.sqrt(
    Math.pow(snapped.x - point.x, 2) + Math.pow(snapped.y - point.y, 2)
  )

  // Only snap if within threshold
  return distance <= threshold ? snapped : point
}

export function snapRect(rect: Rect, options: {
  gridSize?: number
  gridEnabled?: boolean
  threshold?: number
}): Rect {
  const { gridSize = 20, gridEnabled = true } = options

  if (!gridEnabled) return rect

  return snapRectToGrid(rect, gridSize)
}

/**
 * Calculate alignment guides (for future smart guides feature)
 */
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

    // Center alignments
    if (Math.abs(movingCenterX - centerX) < threshold) {
      guides.push({ axis: 'x', value: centerX, type: 'center' })
    }
    if (Math.abs(movingCenterY - centerY) < threshold) {
      guides.push({ axis: 'y', value: centerY, type: 'center' })
    }

    // Edge alignments
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
