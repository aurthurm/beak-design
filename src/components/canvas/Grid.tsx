import { useMemo } from 'react'
import { Line } from 'react-konva'
import { createViewportTransform } from '@/lib/canvas/viewport'
import type { ViewportBounds } from '@/lib/canvas/viewport'

interface GridProps {
  panX: number
  panY: number
  zoom: number
  width: number
  height: number
  enabled: boolean
  size: number
  color: string
  opacity: number
}

export function Grid({
  panX,
  panY,
  zoom,
  width,
  height,
  enabled,
  size,
  color,
  opacity,
}: GridProps) {
  const lines = useMemo(() => {
    if (!enabled) return []

    const transform = createViewportTransform(panX, panY, zoom, width, height)
    const visibleBounds = transform.getVisibleWorldBounds()

    const startX = Math.floor(visibleBounds.x / size) * size
    const endX = Math.ceil((visibleBounds.x + visibleBounds.width) / size) * size
    const startY = Math.floor(visibleBounds.y / size) * size
    const endY = Math.ceil((visibleBounds.y + visibleBounds.height) / size) * size

    const verticalLines: Array<{ x: number; y1: number; y2: number }> = []
    const horizontalLines: Array<{ y: number; x1: number; x2: number }> = []

    for (let x = startX; x <= endX; x += size) {
      const screenX = (x + panX) * zoom
      verticalLines.push({
        x: screenX,
        y1: 0,
        y2: height,
      })
    }

    for (let y = startY; y <= endY; y += size) {
      const screenY = (y + panY) * zoom
      horizontalLines.push({
        y: screenY,
        x1: 0,
        x2: width,
      })
    }

    return { verticalLines, horizontalLines }
  }, [panX, panY, zoom, width, height, size, enabled])

  if (!enabled) return null

  return (
    <>
      {lines.verticalLines.map((line, i) => (
        <Line
          key={`v-${i}`}
          points={[line.x, line.y1, line.x, line.y2]}
          stroke={color}
          strokeWidth={1}
          opacity={opacity}
          listening={false}
        />
      ))}
      {lines.horizontalLines.map((line, i) => (
        <Line
          key={`h-${i}`}
          points={[line.x1, line.y, line.x2, line.y]}
          stroke={color}
          strokeWidth={1}
          opacity={opacity}
          listening={false}
        />
      ))}
    </>
  )
}
