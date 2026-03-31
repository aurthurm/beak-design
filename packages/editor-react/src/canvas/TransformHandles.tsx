import { Group, Circle, Line } from 'react-konva'
import type { Rect } from '@/lib/schema'
import { createViewportTransform } from '@/lib/canvas/viewport'
import type { TransformHandle } from '@/lib/canvas/hooks/useTransform'

interface TransformHandlesProps {
  rect: Rect
  panX: number
  panY: number
  zoom: number
  screenWidth: number
  screenHeight: number
  onHandleDragStart?: (handle: TransformHandle) => void
}

const HANDLE_SIZE = 8
const HANDLE_RADIUS = HANDLE_SIZE / 2

export function TransformHandles({
  rect,
  panX,
  panY,
  zoom,
  screenWidth,
  screenHeight,
  onHandleDragStart,
}: TransformHandlesProps) {
  const transform = createViewportTransform(panX, panY, zoom, screenWidth, screenHeight)
  const screenRect = transform.worldRectToScreen(rect)

  const handles: Array<{ handle: TransformHandle; x: number; y: number }> = [
    { handle: 'nw', x: screenRect.x, y: screenRect.y },
    { handle: 'n', x: screenRect.x + screenRect.w / 2, y: screenRect.y },
    { handle: 'ne', x: screenRect.x + screenRect.w, y: screenRect.y },
    { handle: 'w', x: screenRect.x, y: screenRect.y + screenRect.h / 2 },
    { handle: 'e', x: screenRect.x + screenRect.w, y: screenRect.y + screenRect.h / 2 },
    { handle: 'sw', x: screenRect.x, y: screenRect.y + screenRect.h },
    { handle: 's', x: screenRect.x + screenRect.w / 2, y: screenRect.y + screenRect.h },
    { handle: 'se', x: screenRect.x + screenRect.w, y: screenRect.y + screenRect.h },
  ]

  const handleMouseDown = (handle: TransformHandle, e: any) => {
    e.cancelBubble = true
    onHandleDragStart?.(handle)
  }

  const getCursor = (handle: TransformHandle): string => {
    switch (handle) {
      case 'nw':
      case 'se':
        return 'nwse-resize'
      case 'ne':
      case 'sw':
        return 'nesw-resize'
      case 'n':
      case 's':
        return 'ns-resize'
      case 'w':
      case 'e':
        return 'ew-resize'
      case 'rotate':
        return 'grab'
      default:
        return 'default'
    }
  }

  return (
    <Group>
      {/* Corner handles */}
      {handles.map(({ handle, x, y }) => (
        <Circle
          key={handle}
          x={x}
          y={y}
          radius={HANDLE_RADIUS}
          fill="#ffffff"
          stroke="#0066ff"
          strokeWidth={2}
          listening={true}
          style={{ cursor: getCursor(handle) }}
          onMouseDown={(e) => handleMouseDown(handle, e)}
          onTouchStart={(e) => handleMouseDown(handle, e)}
          onMouseEnter={(e) => {
            const stage = e.target.getStage()
            if (stage) {
              stage.container().style.cursor = getCursor(handle)
            }
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage()
            if (stage) {
              stage.container().style.cursor = 'default'
            }
          }}
        />
      ))}
      
      {/* Rotation handle (above top center) */}
      <Group>
        <Line
          points={[
            screenRect.x + screenRect.w / 2,
            screenRect.y,
            screenRect.x + screenRect.w / 2,
            screenRect.y - 20,
          ]}
          stroke="#0066ff"
          strokeWidth={1}
          listening={false}
        />
        <Circle
          x={screenRect.x + screenRect.w / 2}
          y={screenRect.y - 20}
          radius={HANDLE_RADIUS}
          fill="#ffffff"
          stroke="#0066ff"
          strokeWidth={2}
          listening={true}
          style={{ cursor: getCursor('rotate') }}
          onMouseDown={(e) => handleMouseDown('rotate', e)}
          onTouchStart={(e) => handleMouseDown('rotate', e)}
          onMouseEnter={(e) => {
            const stage = e.target.getStage()
            if (stage) {
              stage.container().style.cursor = getCursor('rotate')
            }
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage()
            if (stage) {
              stage.container().style.cursor = 'default'
            }
          }}
        />
      </Group>
    </Group>
  )
}
