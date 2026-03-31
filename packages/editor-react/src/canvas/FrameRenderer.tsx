import { Group, Rect as KonvaRect, Text } from 'react-konva'
import { useMemo } from 'react'
import type { Frame, FrameId } from '@/lib/schema'
import { createViewportTransform } from '@/lib/canvas/viewport'
import { fillStyleToKonva } from '@/lib/canvas/utils/konva-helpers'

interface FrameRendererProps {
  frame: Frame
  frameId: FrameId
  panX: number
  panY: number
  zoom: number
  screenWidth: number
  screenHeight: number
  isSelected: boolean
  isHovered?: boolean
  isActive?: boolean // Active state when dragging shape over frame (can receive shape)
  onClick?: (frameId: FrameId) => void
}

export function FrameRenderer({
  frame,
  frameId,
  panX,
  panY,
  zoom,
  screenWidth,
  screenHeight,
  isSelected,
  isHovered = false,
  isActive = false,
  onClick,
}: FrameRendererProps) {
  const transform = useMemo(
    () => createViewportTransform(panX, panY, zoom, screenWidth, screenHeight),
    [panX, panY, zoom, screenWidth, screenHeight]
  )

  const screenRect = useMemo(() => {
    return transform.worldRectToScreen(frame.rect)
  }, [transform, frame.rect])

  const fill = useMemo(() => {
    // If no background is set, use white default
    if (!frame.background || frame.background.kind === 'none') {
      return {
        fill: '#FFFFFF', // White
        fillEnabled: true,
      }
    }
    return fillStyleToKonva(frame.background)
  }, [frame.background])

  const handleClick = () => {
    if (!frame.flags?.locked) {
      onClick?.(frameId)
    }
  }

  const handleLabelClick = (e: any) => {
    // Select the frame when clicking the label
    if (!frame.flags?.locked) {
      onClick?.(frameId)
      // Don't stop propagation - let the stage handler prepare for dragging
      // The stage handler will see the frame is selected and prepare drag state
    }
  }

  if (frame.flags?.hidden) {
    return null
  }

  return (
    <>
      <Group
        onClick={handleClick}
        onTap={handleClick}
      >
        {/* Frame background */}
        <KonvaRect
          x={screenRect.x}
          y={screenRect.y}
          width={screenRect.w}
          height={screenRect.h}
          fill={fill.fill}
          fillEnabled={fill.fillEnabled}
          stroke={
            isSelected 
              ? '#0066ff' 
              : isActive 
                ? '#00aaff' // Active blue when dragging shape over frame (can receive shape)
                : isHovered 
                  ? '#00aaff' 
                  : '#cccccc'
          }
          strokeWidth={isSelected ? 2 : (isActive || isHovered) ? 2 : 1}
          listening={!frame.flags?.locked}
        />
        {/* Active frame indicator - subtle glow effect when can receive shape */}
        {isActive && !isSelected && (
          <KonvaRect
            x={screenRect.x - 1}
            y={screenRect.y - 1}
            width={screenRect.w + 2}
            height={screenRect.h + 2}
            fillEnabled={false}
            stroke="#00aaff"
            strokeWidth={1}
            opacity={0.5}
            listening={false}
          />
        )}
        
        {/* Frame label - positioned outside top-left */}
        <Text
          x={screenRect.x}
          y={screenRect.y - 20}
          text={frame.name}
          fontSize={12}
          fill="#666666"
          listening={!frame.flags?.locked}
          onClick={handleLabelClick}
          onTap={handleLabelClick}
        />
      </Group>
    </>
  )
}
