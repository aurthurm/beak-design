import type { Rect, Point } from '../schema'

export type ViewportBounds = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Transform coordinates between world space (document coordinates) and screen space (viewport coordinates)
 */
export class ViewportTransform {
  constructor(
    public panX: number,
    public panY: number,
    public zoom: number,
    public screenWidth: number,
    public screenHeight: number
  ) {}

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(point: Point): Point {
    return {
      x: (point.x + this.panX) * this.zoom,
      y: (point.y + this.panY) * this.zoom,
    }
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(point: Point): Point {
    return {
      x: point.x / this.zoom - this.panX,
      y: point.y / this.zoom - this.panY,
    }
  }

  /**
   * Convert world rect to screen rect
   */
  worldRectToScreen(rect: Rect): Rect {
    const topLeft = this.worldToScreen({ x: rect.x, y: rect.y })
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: rect.w * this.zoom,
      h: rect.h * this.zoom,
    }
  }

  /**
   * Convert screen rect to world rect
   */
  screenRectToWorld(rect: Rect): Rect {
    const topLeft = this.screenToWorld({ x: rect.x, y: rect.y })
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: rect.w / this.zoom,
      h: rect.h / this.zoom,
    }
  }

  /**
   * Get the visible world bounds
   */
  getVisibleWorldBounds(): ViewportBounds {
    const topLeft = this.screenToWorld({ x: 0, y: 0 })
    const bottomRight = this.screenToWorld({
      x: this.screenWidth,
      y: this.screenHeight,
    })
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    }
  }

  /**
   * Zoom to fit a rect in the viewport
   */
  zoomToFit(rect: Rect, padding: number = 50): { panX: number; panY: number; zoom: number } {
    const scaleX = (this.screenWidth - padding * 2) / rect.w
    const scaleY = (this.screenHeight - padding * 2) / rect.h
    const zoom = Math.min(scaleX, scaleY, 10) // Cap at max zoom

    const centerX = rect.x + rect.w / 2
    const centerY = rect.y + rect.h / 2

    const panX = this.screenWidth / 2 / zoom - centerX
    const panY = this.screenHeight / 2 / zoom - centerY

    return { panX, panY, zoom }
  }

  /**
   * Zoom at a specific point (screen coordinates)
   */
  zoomAtPoint(newZoom: number, screenPoint: Point): { panX: number; panY: number; zoom: number } {
    const worldPoint = this.screenToWorld(screenPoint)
    const zoom = Math.max(0.1, Math.min(10, newZoom))

    const panX = screenPoint.x / zoom - worldPoint.x
    const panY = screenPoint.y / zoom - worldPoint.y

    return { panX, panY, zoom }
  }
}

/**
 * Create a viewport transform instance
 */
export function createViewportTransform(
  panX: number,
  panY: number,
  zoom: number,
  screenWidth: number,
  screenHeight: number
): ViewportTransform {
  return new ViewportTransform(panX, panY, zoom, screenWidth, screenHeight)
}
