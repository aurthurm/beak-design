import { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '@tanstack/react-store'
import { canvasStore, canvasActions } from '@/lib/canvas/store'
import { createViewportTransform } from '@/lib/canvas/viewport'

interface RulerProps {
  width: number
  height: number
  sidebarWidth: number
}

const RULER_HEIGHT = 24 // Height of horizontal ruler
const RULER_WIDTH = 24 // Width of vertical ruler
const RULER_GAP = 50 // Gap between ruler marks in pixels (world space)
const TICK_HEIGHT = 8 // Height of tick marks (small ticks)
const TEXT_OFFSET = 13 // Vertical offset for text above ticks (with spacing from ticks)
const VERTICAL_TEXT_OFFSET = 5 // Horizontal offset for text to the left of ticks

export function Ruler({ width, height, sidebarWidth }: RulerProps) {
  const canvasState = useStore(canvasStore)
  const { panX, panY, zoom } = canvasState
  const [isHoveringHorizontal, setIsHoveringHorizontal] = useState(false)
  const [isHoveringVertical, setIsHoveringVertical] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; type: 'horizontal' | 'vertical' } | null>(null)
  const canvasViewportRef = useRef<HTMLElement | null>(null)

  // Create viewport transform to convert world coordinates to screen
  // Note: The transform uses the full canvas dimensions, but we need to account
  // for the sidebar offset when rendering
  const transform = createViewportTransform(panX, panY, zoom, width, height)

  // Handle mouse down on rulers to start dragging guide lines
  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'horizontal' | 'vertical') => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    
    // Find the canvas viewport element
    const canvasViewport = (e.currentTarget as HTMLElement).closest('[data-canvas-viewport="true"]') as HTMLElement
    canvasViewportRef.current = canvasViewport
    const canvasRect = canvasViewport.getBoundingClientRect()
    
    if (type === 'horizontal') {
      // Top ruler: track initial Y position for horizontal guide line (just below ruler)
      const screenY = e.clientY - canvasRect.top - RULER_HEIGHT
      const worldY = transform.screenToWorld({ x: 0, y: screenY }).y
      // Snap to 1px increments
      const snappedWorldY = Math.round(worldY)
      dragStartRef.current = { x: 0, y: snappedWorldY, type: 'horizontal' }
      initialPositionRef.current = snappedWorldY
      // Create temporary guide line preview
      canvasActions.setTemporaryGuideLine({
        id: 'temp-guide',
        type: 'horizontal',
        position: snappedWorldY,
      })
    } else {
      // Left ruler: track initial X position for vertical guide line
      const screenX = e.clientX - canvasRect.left
      const worldX = transform.screenToWorld({ x: screenX, y: 0 }).x
      // Snap to 1px increments
      const snappedWorldX = Math.round(worldX)
      dragStartRef.current = { x: snappedWorldX, y: 0, type: 'vertical' }
      initialPositionRef.current = snappedWorldX
      // Create temporary guide line preview
      canvasActions.setTemporaryGuideLine({
        id: 'temp-guide',
        type: 'vertical',
        position: snappedWorldX,
      })
    }
  }, [transform])

  // Track initial position for comparison
  const initialPositionRef = useRef<number | null>(null)

  // Handle mouse move to update guide line position
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !canvasViewportRef.current) return
    
    const { type } = dragStartRef.current
    const canvasRect = canvasViewportRef.current.getBoundingClientRect()
    
    if (type === 'horizontal') {
      // For top ruler: track Y position (how far down) for horizontal guide line
      const screenY = e.clientY - canvasRect.top - RULER_HEIGHT
      const worldY = transform.screenToWorld({ x: 0, y: screenY }).y
      // Snap to 1px increments
      const snappedWorldY = Math.round(worldY)
      dragStartRef.current = { ...dragStartRef.current, y: snappedWorldY }
      // Update temporary guide line preview
      canvasActions.setTemporaryGuideLine({
        id: 'temp-guide',
        type: 'horizontal',
        position: snappedWorldY,
      })
    } else {
      // For left ruler: track X position (how far right) for vertical guide line
      const screenX = e.clientX - canvasRect.left
      const worldX = transform.screenToWorld({ x: screenX, y: 0 }).x
      // Snap to 1px increments
      const snappedWorldX = Math.round(worldX)
      dragStartRef.current = { ...dragStartRef.current, x: snappedWorldX }
      // Update temporary guide line preview
      canvasActions.setTemporaryGuideLine({
        id: 'temp-guide',
        type: 'vertical',
        position: snappedWorldX,
      })
    }
  }, [isDragging, transform])

  // Handle mouse up to create guide line
  const handleMouseUp = useCallback(() => {
    // Clear temporary guide line
    canvasActions.setTemporaryGuideLine(null)
    
    if (!isDragging || !dragStartRef.current || initialPositionRef.current === null) {
      setIsDragging(false)
      dragStartRef.current = null
      initialPositionRef.current = null
      return
    }
    
    const { x, y, type } = dragStartRef.current
    
    // Only create guide line if dragged outside the ruler area (threshold check)
    if (type === 'horizontal') {
      // Top ruler: create horizontal guide line at Y position
      const draggedDistance = Math.abs(y - initialPositionRef.current)
      if (draggedDistance > 5) {
        canvasActions.addGuideLine({
          id: `guide-${Date.now()}-${Math.random()}`,
          type: 'horizontal',
          position: y,
        })
      }
    } else {
      // Left ruler: create vertical guide line at X position
      const draggedDistance = Math.abs(x - initialPositionRef.current)
      if (draggedDistance > 5) {
        canvasActions.addGuideLine({
          id: `guide-${Date.now()}-${Math.random()}`,
          type: 'vertical',
          position: x,
        })
      }
    }
    
    setIsDragging(false)
    dragStartRef.current = null
    initialPositionRef.current = null
  }, [isDragging])

  // Set up global mouse move and up handlers
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Calculate visible world bounds
  const visibleBounds = transform.getVisibleWorldBounds()

  // Calculate the range of marks to show (with some padding for smooth scrolling)
  const startX = Math.floor(visibleBounds.x / RULER_GAP) * RULER_GAP - RULER_GAP
  const endX = Math.ceil((visibleBounds.x + visibleBounds.width) / RULER_GAP) * RULER_GAP + RULER_GAP
  const startY = Math.floor(visibleBounds.y / RULER_GAP) * RULER_GAP - RULER_GAP
  const endY = Math.ceil((visibleBounds.y + visibleBounds.height) / RULER_GAP) * RULER_GAP + RULER_GAP

  // Generate marks for horizontal ruler
  const horizontalMarks: Array<{ x: number; value: number }> = []
  for (let worldX = startX; worldX <= endX; worldX += RULER_GAP) {
    const screenPoint = transform.worldToScreen({ x: worldX, y: 0 })
    // Screen coordinates are relative to canvas viewport (which starts at sidebar edge)
    // Only include marks that are visible or near visible area
    if (screenPoint.x >= -100 && screenPoint.x <= width + 100) {
      horizontalMarks.push({ x: screenPoint.x, value: worldX })
    }
  }

  // Generate marks for vertical ruler
  const verticalMarks: Array<{ y: number; value: number }> = []
  for (let worldY = startY; worldY <= endY; worldY += RULER_GAP) {
    const screenPoint = transform.worldToScreen({ x: 0, y: worldY })
    // Only include marks that are visible in the ruler area (accounting for ruler height)
    if (screenPoint.y >= RULER_HEIGHT - 100 && screenPoint.y <= height + 100) {
      verticalMarks.push({ y: screenPoint.y, value: worldY })
    }
  }

  return (
    <>
      {/* Horizontal Ruler */}
      <div
        onMouseEnter={() => setIsHoveringHorizontal(true)}
        onMouseLeave={() => setIsHoveringHorizontal(false)}
        onMouseDown={(e) => handleMouseDown(e, 'horizontal')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: width,
          height: RULER_HEIGHT,
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #d0d0d0',
          borderLeft: '1px solid #d0d0d0',
          zIndex: 30,
          pointerEvents: 'auto',
          cursor: isDragging && dragStartRef.current?.type === 'horizontal' ? 'grabbing' : isHoveringHorizontal ? 'ns-resize' : 'default',
          overflow: 'hidden',
        }}
      >
        <svg
          width={width}
          height={RULER_HEIGHT}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {horizontalMarks.map((mark) => {
            // Screen X is already relative to the canvas viewport (which starts at sidebar edge)
            const rulerX = mark.x
            return (
              <g key={`h-${mark.value}`}>
                {/* Small tick mark near the edge */}
                <line
                  x1={rulerX}
                  y1={RULER_HEIGHT - TICK_HEIGHT}
                  x2={rulerX}
                  y2={RULER_HEIGHT}
                  stroke="#999"
                  strokeWidth="1"
                />
                {/* Number centered above the tick mark */}
                <text
                  x={rulerX}
                  y={RULER_HEIGHT - TEXT_OFFSET}
                  fontSize="10"
                  fill="#333"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ userSelect: 'none' }}
                >
                  {mark.value}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Vertical Ruler - positioned at left edge (sidebar edge) */}
      <div
        onMouseEnter={() => setIsHoveringVertical(true)}
        onMouseLeave={() => setIsHoveringVertical(false)}
        onMouseDown={(e) => handleMouseDown(e, 'vertical')}
        style={{
          position: 'absolute',
          top: RULER_HEIGHT,
          left: 0,
          width: RULER_WIDTH,
          height: height - RULER_HEIGHT,
          backgroundColor: '#f5f5f5',
          borderLeft: '1px solid #d0d0d0',
          borderRight: '1px solid #d0d0d0',
          zIndex: 30,
          pointerEvents: 'auto',
          cursor: isDragging && dragStartRef.current?.type === 'vertical' ? 'grabbing' : isHoveringVertical ? 'ew-resize' : 'default',
          overflow: 'hidden',
        }}
      >
        <svg
          width={RULER_WIDTH}
          height={height - RULER_HEIGHT}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {verticalMarks.map((mark) => {
            // Convert screen Y to ruler-relative Y (subtract ruler height)
            const rulerY = mark.y - RULER_HEIGHT
            return (
              <g key={`v-${mark.value}`}>
                {/* Small tick mark on the right side */}
                <line
                  x1={RULER_WIDTH - TICK_HEIGHT}
                  y1={rulerY}
                  x2={RULER_WIDTH}
                  y2={rulerY}
                  stroke="#999"
                  strokeWidth="1"
                />
                {/* Number on the left side, with spacing from tick mark */}
                <text
                  x={RULER_WIDTH - TICK_HEIGHT - VERTICAL_TEXT_OFFSET}
                  y={rulerY}
                  fontSize="10"
                  fill="#333"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  transform={`rotate(-90 ${RULER_WIDTH - TICK_HEIGHT - VERTICAL_TEXT_OFFSET} ${rulerY})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ userSelect: 'none' }}
                >
                  {mark.value}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </>
  )
}
