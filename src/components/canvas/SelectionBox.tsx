import { Rect as KonvaRect } from 'react-konva'
import type { Rect } from '@/lib/schema'
import { createViewportTransform } from '@/lib/canvas/viewport'

interface SelectionBoxProps {
  rect: Rect | undefined
  panX: number
  panY: number
  zoom: number
  screenWidth: number
  screenHeight: number
}

export function SelectionBox({
  rect,
  panX,
  panY,
  zoom,
  screenWidth,
  screenHeight,
}: SelectionBoxProps) {
  if (!rect) return null

  const transform = createViewportTransform(panX, panY, zoom, screenWidth, screenHeight)
  const screenRect = transform.worldRectToScreen(rect)

  return (
    <KonvaRect
      x={screenRect.x}
      y={screenRect.y}
      width={screenRect.w}
      height={screenRect.h}
      stroke="#0066ff"
      strokeWidth={1}
      fill="rgba(0, 102, 255, 0.1)"
      dash={[5, 5]}
      listening={false}
    />
  )
}
