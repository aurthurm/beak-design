import type { Point, Rect } from '../../schema/src'

export type ViewportBounds = {
  x: number
  y: number
  width: number
  height: number
}

export class ViewportTransform {
  constructor(
    public panX: number,
    public panY: number,
    public zoom: number,
    public screenWidth: number,
    public screenHeight: number
  ) {}

  worldToScreen(point: Point): Point {
    return {
      x: (point.x + this.panX) * this.zoom,
      y: (point.y + this.panY) * this.zoom,
    }
  }

  screenToWorld(point: Point): Point {
    return {
      x: point.x / this.zoom - this.panX,
      y: point.y / this.zoom - this.panY,
    }
  }

  worldRectToScreen(rect: Rect): Rect {
    const topLeft = this.worldToScreen({ x: rect.x, y: rect.y })
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: rect.w * this.zoom,
      h: rect.h * this.zoom,
    }
  }

  screenRectToWorld(rect: Rect): Rect {
    const topLeft = this.screenToWorld({ x: rect.x, y: rect.y })
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: rect.w / this.zoom,
      h: rect.h / this.zoom,
    }
  }

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

  zoomToFit(rect: Rect, padding: number = 50): { panX: number; panY: number; zoom: number } {
    const scaleX = (this.screenWidth - padding * 2) / rect.w
    const scaleY = (this.screenHeight - padding * 2) / rect.h
    const zoom = Math.min(scaleX, scaleY, 10)

    const centerX = rect.x + rect.w / 2
    const centerY = rect.y + rect.h / 2

    const panX = this.screenWidth / 2 / zoom - centerX
    const panY = this.screenHeight / 2 / zoom - centerY

    return { panX, panY, zoom }
  }

  zoomAtPoint(newZoom: number, screenPoint: Point): { panX: number; panY: number; zoom: number } {
    const worldPoint = this.screenToWorld(screenPoint)
    const zoom = Math.max(0.1, Math.min(10, newZoom))

    const panX = screenPoint.x / zoom - worldPoint.x
    const panY = screenPoint.y / zoom - worldPoint.y

    return { panX, panY, zoom }
  }
}

export function createViewportTransform(
  panX: number,
  panY: number,
  zoom: number,
  screenWidth: number,
  screenHeight: number
): ViewportTransform {
  return new ViewportTransform(panX, panY, zoom, screenWidth, screenHeight)
}
