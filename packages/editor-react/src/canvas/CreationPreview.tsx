import { Group, Rect as KonvaRect, Ellipse, Text as KonvaText } from 'react-konva'
import type { Rect } from '@/lib/schema'
import type { ToolType } from '@/lib/canvas/store'
import { createViewportTransform } from '@/lib/canvas/viewport'

interface CreationPreviewProps {
  rect: Rect
  tool: ToolType
  panX: number
  panY: number
  zoom: number
  screenWidth: number
  screenHeight: number
}

export function CreationPreview({
  rect,
  tool,
  panX,
  panY,
  zoom,
  screenWidth,
  screenHeight,
}: CreationPreviewProps) {
  const transform = createViewportTransform(panX, panY, zoom, screenWidth, screenHeight)
  const screenRect = transform.worldRectToScreen(rect)

  const commonProps = {
    stroke: '#0066ff',
    strokeWidth: 2,
    fill: 'rgba(0, 102, 255, 0.1)',
    listening: false,
  }

  switch (tool) {
    case 'rect':
      return (
        <KonvaRect
          x={screenRect.x}
          y={screenRect.y}
          width={screenRect.w}
          height={screenRect.h}
          {...commonProps}
        />
      )

    case 'ellipse':
      return (
        <Ellipse
          x={screenRect.x + screenRect.w / 2}
          y={screenRect.y + screenRect.h / 2}
          radiusX={screenRect.w / 2}
          radiusY={screenRect.h / 2}
          {...commonProps}
        />
      )

    case 'text':
      return (
        <Group>
          <KonvaRect
            x={screenRect.x}
            y={screenRect.y}
            width={screenRect.w}
            height={screenRect.h}
            {...commonProps}
          />
          <KonvaText
            x={screenRect.x}
            y={screenRect.y}
            width={screenRect.w}
            height={screenRect.h}
            text="Text"
            fontSize={16}
            fill="#666666"
            listening={false}
          />
        </Group>
      )

    case 'frame':
      return (
        <KonvaRect
          x={screenRect.x}
          y={screenRect.y}
          width={screenRect.w}
          height={screenRect.h}
          stroke="#0066ff"
          strokeWidth={2}
          fill="rgba(255, 255, 255, 0.9)"
          listening={false}
        />
      )

    default:
      return (
        <KonvaRect
          x={screenRect.x}
          y={screenRect.y}
          width={screenRect.w}
          height={screenRect.h}
          {...commonProps}
        />
      )
  }
}
