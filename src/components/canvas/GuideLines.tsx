import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Line, Circle, Group } from 'react-konva'
import { useStore } from '@tanstack/react-store'
import { canvasStore, canvasActions } from '@/lib/canvas/store'
import { createViewportTransform } from '@/lib/canvas/viewport'

interface GuideLinesProps {
  width: number
  height: number
}

const GUIDE_LINE_HIT_WIDTH = 8 // Hit area width for easier grabbing
const HANDLE_SIZE = 6 // Size of the handle circles
const RULER_HEIGHT = 24 // Height of horizontal ruler (top)
const RULER_WIDTH = 24 // Width of vertical ruler (left)

export function GuideLines({ width, height }: GuideLinesProps) {
  const canvasState = useStore(canvasStore)
  const { panX, panY, zoom, guideLines, temporaryGuideLine, activeTool } = canvasState
  const isSelectToolActive = activeTool === 'select'
  const [hoveredGuideId, setHoveredGuideId] = useState<string | null>(null)
  const [draggingGuideId, setDraggingGuideId] = useState<string | null>(null)
  const [deletingGuideIds, setDeletingGuideIds] = useState<Set<string>>(new Set())
  const [deletingGuideOpacities, setDeletingGuideOpacities] = useState<Map<string, number>>(new Map())
  const dragStartRef = useRef<{ id: string; startPos: number } | null>(null)
  const deleteTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const deleteAnimationsRef = useRef<Map<string, number>>(new Map()) // Store animation frame IDs

  const transform = createViewportTransform(panX, panY, zoom, width, height)

  // Function to delete guide line with animation
  const deleteGuideLineWithAnimation = useCallback((guideId: string) => {
    // Mark as deleting and start with full opacity
    setDeletingGuideIds((prev) => new Set(prev).add(guideId))
    setDeletingGuideOpacities((prev) => new Map(prev).set(guideId, 0.8))
    
    // Clear any existing timeout/animation for this guide line
    const existingTimeout = deleteTimeoutsRef.current.get(guideId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    const existingFrameId = deleteAnimationsRef.current.get(guideId)
    if (existingFrameId) {
      cancelAnimationFrame(existingFrameId)
      deleteAnimationsRef.current.delete(guideId)
    }
    
    // Animate opacity fade out
    const startOpacity = 0.8
    const duration = 300 // ms
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const currentOpacity = startOpacity * (1 - progress)
      
      setDeletingGuideOpacities((prev) => {
        const next = new Map(prev)
        if (progress >= 1) {
          next.delete(guideId)
        } else {
          next.set(guideId, currentOpacity)
        }
        return next
      })
      
      if (progress < 1) {
        const frameId = requestAnimationFrame(animate)
        deleteAnimationsRef.current.set(guideId, frameId)
      } else {
        // Animation complete - remove from store
        canvasActions.removeGuideLine(guideId)
        setDeletingGuideIds((prev) => {
          const next = new Set(prev)
          next.delete(guideId)
          return next
        })
        deleteTimeoutsRef.current.delete(guideId)
        deleteAnimationsRef.current.delete(guideId)
      }
    }
    
    const frameId = requestAnimationFrame(animate)
    deleteAnimationsRef.current.set(guideId, frameId)
  }, [])

  // Cleanup timeouts and animations on unmount
  useEffect(() => {
    return () => {
      deleteTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      deleteTimeoutsRef.current.clear()
      deleteAnimationsRef.current.forEach((frameId) => cancelAnimationFrame(frameId))
      deleteAnimationsRef.current.clear()
    }
  }, [])

  // Clear dragging state when switching away from select tool
  useEffect(() => {
    if (!isSelectToolActive && draggingGuideId) {
      setDraggingGuideId(null)
      dragStartRef.current = null
      setHoveredGuideId(null)
    }
  }, [isSelectToolActive, draggingGuideId])

  const lines = useMemo(() => {
    const allGuideLines = temporaryGuideLine ? [...guideLines, temporaryGuideLine] : guideLines
    return allGuideLines.map((guideLine) => {
      if (guideLine.type === 'vertical') {
        const screenPoint = transform.worldToScreen({ x: guideLine.position, y: 0 })
        return {
          id: guideLine.id,
          type: 'vertical' as const,
          x: screenPoint.x,
          y1: 0,
          y2: height,
          worldPosition: guideLine.position,
        }
      } else {
        const screenPoint = transform.worldToScreen({ x: 0, y: guideLine.position })
        return {
          id: guideLine.id,
          type: 'horizontal' as const,
          y: screenPoint.y,
          x1: 0,
          x2: width,
          worldPosition: guideLine.position,
        }
      }
    })
  }, [guideLines, temporaryGuideLine, transform, width, height])

  const handleMouseDown = useCallback((e: any, guideId: string, type: 'vertical' | 'horizontal', worldPosition: number) => {
    // Only allow dragging when select tool is active
    if (!isSelectToolActive) return
    
    e.cancelBubble = true
    if (guideId === 'temp-guide') return // Don't drag temporary guide lines
    
    setDraggingGuideId(guideId)
    dragStartRef.current = { id: guideId, startPos: worldPosition }
  }, [isSelectToolActive])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingGuideId || !dragStartRef.current) return

    const guideLine = guideLines.find((gl) => gl.id === draggingGuideId)
    if (!guideLine) return

    // Get canvas viewport element to calculate relative coordinates
    const canvasViewport = document.querySelector('[data-canvas-viewport="true"]') as HTMLElement
    if (!canvasViewport) return
    
    const canvasRect = canvasViewport.getBoundingClientRect()
    
    // Calculate mouse position relative to canvas viewport
    const mouseX = e.clientX - canvasRect.left
    const mouseY = e.clientY - canvasRect.top

    // Check if mouse is over ruler area
    if (guideLine.type === 'vertical') {
      // For vertical guide line, check if mouse is over left ruler
      // Check if mouseX is within the left ruler area (0 to RULER_WIDTH)
      if (mouseX >= 0 && mouseX < RULER_WIDTH) {
        // Mouse is over left ruler - delete the guide line with animation
        // Don't clear dragging state immediately - let the animation show first
        if (!deletingGuideIds.has(draggingGuideId)) {
          deleteGuideLineWithAnimation(draggingGuideId)
          // Clear dragging state after a small delay to allow visual feedback
          setTimeout(() => {
            setDraggingGuideId(null)
            dragStartRef.current = null
          }, 50)
        }
        return
      }
      // Calculate screen X relative to canvas viewport
      const screenX = mouseX
      // Calculate new world X position
      const worldX = transform.screenToWorld({ x: screenX, y: 0 }).x
      const snappedWorldX = Math.round(worldX) // Snap to 1px
      canvasActions.updateGuideLine(draggingGuideId, snappedWorldX)
    } else {
      // For horizontal guide line, check if mouse is over top ruler
      // Check if mouseY is within the top ruler area (0 to RULER_HEIGHT)
      if (mouseY >= 0 && mouseY < RULER_HEIGHT) {
        // Mouse is over top ruler - delete the guide line with animation
        // Don't clear dragging state immediately - let the animation show first
        if (!deletingGuideIds.has(draggingGuideId)) {
          deleteGuideLineWithAnimation(draggingGuideId)
          // Clear dragging state after a small delay to allow visual feedback
          setTimeout(() => {
            setDraggingGuideId(null)
            dragStartRef.current = null
          }, 50)
        }
        return
      }
      // Calculate screen Y relative to canvas viewport (accounting for ruler height)
      const screenY = mouseY - RULER_HEIGHT
      // Calculate new world Y position
      const worldY = transform.screenToWorld({ x: 0, y: screenY }).y
      const snappedWorldY = Math.round(worldY) // Snap to 1px
      canvasActions.updateGuideLine(draggingGuideId, snappedWorldY)
    }
  }, [draggingGuideId, guideLines, transform, deleteGuideLineWithAnimation, deletingGuideIds])

  const handleMouseUp = useCallback((e?: MouseEvent) => {
    if (draggingGuideId && e) {
      // Check if mouse is over ruler area when releasing
      const canvasViewport = document.querySelector('[data-canvas-viewport="true"]') as HTMLElement
      if (canvasViewport) {
        const canvasRect = canvasViewport.getBoundingClientRect()
        const mouseX = e.clientX - canvasRect.left
        const mouseY = e.clientY - canvasRect.top
        
        const guideLine = guideLines.find((gl) => gl.id === draggingGuideId)
        if (guideLine) {
          if (guideLine.type === 'vertical' && mouseX < RULER_WIDTH) {
            // Mouse released over left ruler - delete the guide line with animation
            deleteGuideLineWithAnimation(draggingGuideId)
          } else if (guideLine.type === 'horizontal' && mouseY < RULER_HEIGHT) {
            // Mouse released over top ruler - delete the guide line with animation
            deleteGuideLineWithAnimation(draggingGuideId)
          }
        }
      }
    }
    setDraggingGuideId(null)
    dragStartRef.current = null
  }, [draggingGuideId, guideLines, deleteGuideLineWithAnimation])

  // Set up global mouse handlers for dragging
  useEffect(() => {
    if (draggingGuideId) {
      const mouseMoveHandler = (e: MouseEvent) => handleMouseMove(e)
      const mouseUpHandler = (e: MouseEvent) => handleMouseUp(e)
      window.addEventListener('mousemove', mouseMoveHandler)
      window.addEventListener('mouseup', mouseUpHandler)
      return () => {
        window.removeEventListener('mousemove', mouseMoveHandler)
        window.removeEventListener('mouseup', mouseUpHandler)
      }
    }
  }, [draggingGuideId, handleMouseMove, handleMouseUp])

  if (lines.length === 0) return null

  return (
    <>
      {lines.map((line) => {
        const isTemporary = line.id === 'temp-guide'
        const isHovered = hoveredGuideId === line.id && !isTemporary
        const isDragging = draggingGuideId === line.id
        const isDeleting = deletingGuideIds.has(line.id)
        const deletingOpacity = deletingGuideOpacities.get(line.id) ?? 0.8

        if (line.type === 'vertical') {
          return (
            <Line
              key={line.id}
              points={[line.x, line.y1, line.x, line.y2]}
              stroke={isDeleting ? '#ff0000' : isHovered || isDragging ? '#0066ff' : '#0066ff'}
              strokeWidth={isHovered || isDragging ? 2 : 1}
              opacity={isTemporary ? 0.7 : isDeleting ? deletingOpacity : isHovered || isDragging ? 0.9 : 0.5}
              listening={!isTemporary && !isDeleting && isSelectToolActive}
              dash={[4, 4]}
              onMouseEnter={() => !isTemporary && !isDeleting && isSelectToolActive && setHoveredGuideId(line.id)}
              onMouseLeave={() => setHoveredGuideId(null)}
              onMouseDown={(e) => !isDeleting && isSelectToolActive && handleMouseDown(e, line.id, 'vertical', line.worldPosition)}
              hitStrokeWidth={GUIDE_LINE_HIT_WIDTH}
              perfectDrawEnabled={false}
            />
          )
        } else {
          return (
            <Line
              key={line.id}
              points={[line.x1, line.y, line.x2, line.y]}
              stroke={isDeleting ? '#ff0000' : isHovered || isDragging ? '#0066ff' : '#0066ff'}
              strokeWidth={isHovered || isDragging ? 2 : 1}
              opacity={isTemporary ? 0.7 : isDeleting ? deletingOpacity : isHovered || isDragging ? 0.9 : 0.5}
              listening={!isTemporary && !isDeleting && isSelectToolActive}
              dash={[4, 4]}
              onMouseEnter={() => !isTemporary && !isDeleting && isSelectToolActive && setHoveredGuideId(line.id)}
              onMouseLeave={() => setHoveredGuideId(null)}
              onMouseDown={(e) => !isDeleting && isSelectToolActive && handleMouseDown(e, line.id, 'horizontal', line.worldPosition)}
              hitStrokeWidth={GUIDE_LINE_HIT_WIDTH}
              perfectDrawEnabled={false}
            />
          )
        }
      })}
      
      {/* Render handles for hovered guide lines - only when select tool is active */}
      {isSelectToolActive && lines.map((line) => {
        if (line.id === 'temp-guide') return null
        const isHovered = hoveredGuideId === line.id
        const isDragging = draggingGuideId === line.id
        const isDeleting = deletingGuideIds.has(line.id)
        
        if ((!isHovered && !isDragging) || isDeleting) return null

        if (line.type === 'vertical') {
          // Render handles at top and bottom of vertical guide line
          return (
            <Group key={`handles-${line.id}`}>
              <Circle
                x={line.x}
                y={line.y1 + HANDLE_SIZE}
                radius={HANDLE_SIZE}
                fill={isDeleting ? '#ff0000' : '#0066ff'}
                stroke="#ffffff"
                strokeWidth={1}
                listening={false}
              />
              <Circle
                x={line.x}
                y={line.y2 - HANDLE_SIZE}
                radius={HANDLE_SIZE}
                fill={isDeleting ? '#ff0000' : '#0066ff'}
                stroke="#ffffff"
                strokeWidth={1}
                listening={false}
              />
            </Group>
          )
        } else {
          // Render handles at left and right of horizontal guide line
          return (
            <Group key={`handles-${line.id}`}>
              <Circle
                x={line.x1 + HANDLE_SIZE}
                y={line.y}
                radius={HANDLE_SIZE}
                fill={isDeleting ? '#ff0000' : '#0066ff'}
                stroke="#ffffff"
                strokeWidth={1}
                listening={false}
              />
              <Circle
                x={line.x2 - HANDLE_SIZE}
                y={line.y}
                radius={HANDLE_SIZE}
                fill={isDeleting ? '#ff0000' : '#0066ff'}
                stroke="#ffffff"
                strokeWidth={1}
                listening={false}
              />
            </Group>
          )
        }
      })}
    </>
  )
}
