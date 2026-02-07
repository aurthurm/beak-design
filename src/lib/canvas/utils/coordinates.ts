import type { Point, Rect } from '../../schema'
import type { ViewportTransform } from '../viewport'

/**
 * Coordinate transformation utilities
 */
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

/**
 * Snap a point to grid
 */
export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  }
}

/**
 * Snap a rect to grid
 */
export function snapRectToGrid(rect: Rect, gridSize: number): Rect {
  const snappedTopLeft = snapToGrid({ x: rect.x, y: rect.y }, gridSize)
  const snappedBottomRight = snapToGrid(
    { x: rect.x + rect.w, y: rect.y + rect.h },
    gridSize
  )
  return {
    x: snappedTopLeft.x,
    y: snappedTopLeft.y,
    w: snappedBottomRight.x - snappedTopLeft.x,
    h: snappedBottomRight.y - snappedTopLeft.y,
  }
}

/**
 * Constrain a point within bounds
 */
export function constrainPoint(point: Point, bounds: Rect): Point {
  return {
    x: Math.max(bounds.x, Math.min(bounds.x + bounds.w, point.x)),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.h, point.y)),
  }
}

/**
 * Check if a point is inside a rect
 */
export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  )
}

/**
 * Check if two rects intersect
 */
export function rectsIntersect(rect1: Rect, rect2: Rect): boolean {
  return (
    rect1.x < rect2.x + rect2.w &&
    rect1.x + rect1.w > rect2.x &&
    rect1.y < rect2.y + rect2.h &&
    rect1.y + rect1.h > rect2.y
  )
}

/**
 * Get the union of two rects
 */
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
