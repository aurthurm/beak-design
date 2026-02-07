import { useRef, useEffect, useCallback, useState } from 'react'
import { Stage, Layer as KonvaLayer, Group, Rect as KonvaRect } from 'react-konva'
import { useCanvas } from '@/lib/canvas/hooks/useCanvas'
import { canvasActions } from '@/lib/canvas/store'
import { Grid } from './Grid'
import { GuideLines } from './GuideLines'
import { FrameRenderer } from './FrameRenderer'
import { LayerRenderer } from './LayerRenderer'
import { SelectionBox } from './SelectionBox'
import { TransformHandles } from './TransformHandles'
import { CreationPreview } from './CreationPreview'
import { calculateSelectionBounds } from '@/lib/canvas/selection'
import { createFrameAt, createLayerAt } from '@/lib/canvas/create-handlers'
import { screenToWorld, screenRectToWorld, pointInRect } from '@/lib/canvas/utils/coordinates'
import { createViewportTransform } from '@/lib/canvas/viewport'
import type { FrameId, LayerId, Rect, Point } from '@/lib/schema'

interface KonvaStageProps {
  width: number
  height: number
}

const DRAG_DISTANCE_THRESHOLD = 3

export function KonvaStage({ width, height }: KonvaStageProps) {
  const stageRef = useRef<any>(null)
  const canvas = useCanvas()
  const [selectionBoxRect, setSelectionBoxRect] = useState<Rect | undefined>(undefined)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createStartPoint, setCreateStartPoint] = useState<Point | null>(null)
  const [createPreviewRect, setCreatePreviewRect] = useState<Rect | undefined>(undefined)
  const [isMoving, setIsMoving] = useState(false)
  const [moveStartPoint, setMoveStartPoint] = useState<Point | null>(null)
  const [moveStartRects, setMoveStartRects] = useState<Map<string, Rect>>(new Map())
  const [hasMoved, setHasMoved] = useState(false)
  const [hoverTargetId, setHoverTargetId] = useState<FrameId | LayerId | null>(null)
  const [hoverPart, setHoverPart] = useState<'visible' | 'hidden' | null>(null) // For clipped shapes
  const [activeFrameId, setActiveFrameId] = useState<FrameId | null>(null) // Frame that can receive shape during drag
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [dragTargetIds, setDragTargetIds] = useState<Array<FrameId | LayerId>>([])
  const [selectionBoxStartPoint, setSelectionBoxStartPoint] = useState<Point | null>(null)
  const {
    document,
    activePageId,
    viewport,
    grid,
    selection,
    activeTool,
    startPan,
    updatePan,
    endPan,
    handleWheel,
    startSelectionBox,
    updateSelectionBox,
    endSelectionBox,
    hitTest,
    select,
    toggleSelection,
    clearSelection,
    startTransform,
    updateTransform,
    endTransform,
    isTransforming,
  } = canvas


  // Track space key for panning and ESC to cancel selection box
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(true)
      } else if (e.key === 'Escape') {
        if (canvas.isSelecting) {
          // Cancel selection box on ESC
          setSelectionBoxRect(undefined)
          setSelectionBoxStartPoint(null)
          canvasActions.setIsSelecting(false)
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false)
        if (canvas.isPanning) {
          endPan()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [canvas.isPanning, canvas.isSelecting, endPan])

  // Handle mouse wheel for zoom
  useEffect(() => {
    const handleWheelEvent = (e: WheelEvent) => {
      if (stageRef.current) {
        handleWheel(e, width, height)
      }
    }

    const container = stageRef.current?.container()
    if (container) {
      container.addEventListener('wheel', handleWheelEvent, { passive: false })
      return () => {
        container.removeEventListener('wheel', handleWheelEvent)
      }
    }
  }, [handleWheel, width, height])


  // Sync dragTargetIds with selection when not actively dragging
  useEffect(() => {
    if (!isMoving && !isMouseDown && selection.selectedIds.length > 0) {
      setDragTargetIds(selection.selectedIds)
    }
  }, [selection.selectedIds, isMoving, isMouseDown])

  const handleStageMouseDown = useCallback((e: any) => {
    const stage = e.target.getStage()
    const pointerPos = stage.getPointerPosition()

    if (!pointerPos) return

    // Track that mouse button is down
    setIsMouseDown(true)

    // Handle pan tool or middle mouse button or space+drag for panning
    if (activeTool === 'pan' || e.evt.button === 1 || (e.evt.button === 0 && isSpacePressed)) {
      startPan(pointerPos)
      return
    }

    // Handle tool creation - start drag-based creation
    if (activeTool !== 'select' && activeTool !== 'pan' && e.evt.button === 0) {
      setIsCreating(true)
      setCreateStartPoint(pointerPos)
      return
    }

    // Don't handle stage events if we're transforming (handles will handle it)
    if (isTransforming) {
      return
    }

    // Check if clicking on a layer or frame
    if (document && activePageId) {
      const page = document.pages[activePageId]
      if (!page) return

      // Get frames for this page
      const frames = page.frameIds
        .map((frameId) => document.frames[frameId])
        .filter(Boolean)

      // Check hit test
      const hitId = hitTest(pointerPos, width, height, 
        Object.fromEntries(frames.map(f => [f.id, f])),
        document.layers
      )

      if (hitId) {
        // Check if the hit item is locked
        const hitLayer = document.layers[hitId]
        const hitFrame = document.frames[hitId as any]
        const isLocked = hitLayer?.flags?.locked || hitFrame?.flags?.locked
        
        // Don't allow selection or dragging of locked items
        if (isLocked) {
          return
        }
        
        const wasSelected = selection.selectedIds.includes(hitId)
        
        // Calculate what the selection will be after this click
        let finalSelectedIds: Array<FrameId | LayerId>
        if (e.evt.shiftKey) {
          // Shift-click: toggle selection
          if (wasSelected) {
            // Remove from selection
            finalSelectedIds = selection.selectedIds.filter(id => id !== hitId)
          } else {
            // Add to selection
            finalSelectedIds = [...selection.selectedIds, hitId]
          }
          toggleSelection(hitId, activePageId)
        } else {
          // Normal click behavior:
          // - If clicking on an already-selected item, keep current selection (for dragging)
          // - If clicking on a non-selected item, select only that item
          if (wasSelected && selection.selectedIds.length > 1) {
            // Clicking on an already-selected item in a multi-selection: keep selection for dragging
            finalSelectedIds = selection.selectedIds
            // Don't call select() - keep the existing selection
          } else {
            // Clicking on a non-selected item or single selection: select only this item
            finalSelectedIds = [hitId]
            select(hitId, activePageId)
          }
        }
        
        // Prepare for potential drag - but don't start moving until mouse actually moves
        if (finalSelectedIds.length > 0) {
          setMoveStartPoint(pointerPos)
          setHasMoved(false)
          setMoveStartRects(new Map())
          setDragTargetIds(finalSelectedIds)
        }
      } else {
        // Clicked on empty canvas or label area
        // Check if clicking on any frame's label area (regardless of selection)
        if (activeTool === 'select' && document && activePageId) {
          const page = document.pages[activePageId]
          if (page) {
            const transform = createViewportTransform(viewport.panX, viewport.panY, viewport.zoom, width, height)
            
            // Check all frames to see if click is on a label
            const clickedFrameId = page.frameIds.find(frameId => {
              const frame = document.frames[frameId]
              if (!frame || frame.flags?.locked || frame.flags?.hidden) return false
              
              const screenRect = transform.worldRectToScreen(frame.rect)
              // Check if click is near the label area (above the frame)
              // Label is positioned at y: screenRect.y - 20, so check a bit wider area
              const labelArea = {
                x: screenRect.x - 5, // Add some padding
                y: screenRect.y - 30, // Label is 20px above, check 30px to be safe
                w: screenRect.w + 10, // Add padding
                h: 30
              }
              return pointInRect(pointerPos, labelArea)
            })
            
            if (clickedFrameId) {
              // User clicked on a frame label - select it and prepare for dragging
              const wasSelected = selection.selectedIds.includes(clickedFrameId)
              
              if (!wasSelected) {
                // Select the frame first
                select(clickedFrameId, activePageId)
              }
              
              // Prepare for dragging (use current selection or the clicked frame)
              const framesToDrag = wasSelected ? selection.selectedIds : [clickedFrameId]
              setMoveStartPoint(pointerPos)
              setHasMoved(false)
              setMoveStartRects(new Map())
              setDragTargetIds(framesToDrag)
              return
            }
          }
        }
        
        // Clicked on empty canvas - maybe start dragging current selection if clicking inside its bounds
        if (selection.selectedIds.length > 0 && document) {
          const bounds = calculateSelectionBounds(selection.selectedIds, document)
          if (bounds) {
            const transform = createViewportTransform(viewport.panX, viewport.panY, viewport.zoom, width, height)
            const selectionScreenRect = transform.worldRectToScreen(bounds)
            if (pointInRect(pointerPos, selectionScreenRect)) {
              setMoveStartPoint(pointerPos)
              setHasMoved(false)
              setMoveStartRects(new Map())
              setDragTargetIds(selection.selectedIds)
              return
            }
          }
        }
        if (selection.selectedIds.length > 0) {
          clearSelection()
          setDragTargetIds([])
        }
        // Prepare for potential selection box drag (but don't start it yet)
        if (e.evt.button === 0 && activeTool === 'select') {
          setSelectionBoxStartPoint(pointerPos)
          setSelectionBoxRect(undefined)
        } else {
          setSelectionBoxStartPoint(null)
          setSelectionBoxRect(undefined)
        }
      }
    }
  }, [
    document,
    activePageId,
    width,
    height,
    activeTool,
    isSpacePressed,
    startPan,
    hitTest,
    select,
    toggleSelection,
    startSelectionBox,
    clearSelection,
    isTransforming,
    selection.selectedIds,
    viewport.panX,
    viewport.panY,
    viewport.zoom,
  ])

  const handleStageMouseMove = useCallback((e: any) => {
    const stage = e.target.getStage()
    const pointerPos = stage.getPointerPosition()

    if (!pointerPos) return

    if (canvas.isPanning) {
      updatePan(pointerPos)
    } else if (selectionBoxStartPoint && isMouseDown && activeTool === 'select' && !canvas.isSelecting) {
      // Check if mouse has moved enough to start selection box drag
      const deltaX = pointerPos.x - selectionBoxStartPoint.x
      const deltaY = pointerPos.y - selectionBoxStartPoint.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      
      // Only start selection box if mouse moved beyond threshold
      if (distance > DRAG_DISTANCE_THRESHOLD) {
        startSelectionBox(selectionBoxStartPoint)
      }
    } else if (isCreating && createStartPoint) {
      // Update creation preview with actual shape preview
      const minX = Math.min(createStartPoint.x, pointerPos.x)
      const minY = Math.min(createStartPoint.y, pointerPos.y)
      const maxX = Math.max(createStartPoint.x, pointerPos.x)
      const maxY = Math.max(createStartPoint.y, pointerPos.y)
      const screenRect: Rect = {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
      }
      // Convert to world coordinates for preview
      const transform = createViewportTransform(viewport.panX, viewport.panY, viewport.zoom, width, height)
      const worldRect = screenRectToWorld(screenRect, transform)
      setCreatePreviewRect(worldRect)
      setSelectionBoxRect(screenRect)
    } else if (moveStartPoint && document && isMouseDown && (dragTargetIds.length > 0 || selection.selectedIds.length > 0)) {
      // Only process movement if mouse button is actually pressed down
      // Check if mouse has moved significantly (drag threshold)
      const deltaX = pointerPos.x - moveStartPoint.x
      const deltaY = pointerPos.y - moveStartPoint.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      
      // Only start moving if mouse moved beyond the drag threshold
      if (distance > DRAG_DISTANCE_THRESHOLD) {
        // Use current selection for dragging (dragTargetIds should be synced via useEffect)
        // Fall back to dragTargetIds if selection is empty (shouldn't happen, but safety check)
        const idsToDrag = selection.selectedIds.length > 0 ? selection.selectedIds : dragTargetIds
        
        let rectsForMovement = moveStartRects
        if (!hasMoved) {
          const rects = new Map<string, Rect>()
          const visitedLayerIds = new Set<LayerId>()

          const addLayerAndDescendants = (layerId: LayerId) => {
            if (visitedLayerIds.has(layerId)) return
            visitedLayerIds.add(layerId)
            const targetLayer = document.layers[layerId]
            if (!targetLayer || targetLayer.flags?.locked) return
            rects.set(layerId, targetLayer.rect)
            if (targetLayer.children?.length) {
              targetLayer.children.forEach(addLayerAndDescendants)
            }
          }

          idsToDrag.forEach(id => {
            const layer = document.layers[id]
            const frame = document.frames[id as any]
            // Skip locked items
            if (layer && !layer.flags?.locked) {
              addLayerAndDescendants(layer.id)
            } else if (frame && !frame.flags?.locked) {
              rects.set(id, frame.rect)
              frame.childLayerIds?.forEach(addLayerAndDescendants)
            }
          })

          if (rects.size > 0) {
            rectsForMovement = rects
            setMoveStartRects(rects)
          }
        }

        if (!isMoving) {
          setIsMoving(true)
        }
        if (!hasMoved) {
          setHasMoved(true)
        }

        // Check what we're hovering over for visual feedback
        if (activePageId) {
          const page = document.pages[activePageId]
          if (page) {
            const frames = page.frameIds.map((frameId) => document.frames[frameId]).filter(Boolean)
            const hoverId = hitTest(pointerPos, width, height, 
              Object.fromEntries(frames.map(f => [f.id, f])),
              document.layers
            )
            setHoverTargetId(hoverId)
          }
        }

        // Convert mouse pointer position to world coordinates
        const transform = createViewportTransform(viewport.panX, viewport.panY, viewport.zoom, width, height)
        const worldPointerPos = screenToWorld(pointerPos, transform)

        // Find which frame (if any) contains the mouse pointer
        let targetFrameId: FrameId | null = null
        if (activePageId) {
          const page = document.pages[activePageId]
          if (page) {
            const frames = page.frameIds.map((frameId) => document.frames[frameId]).filter(Boolean)
            // Find frame containing the pointer
            const containingFrame = frames.find((frame) =>
              pointInRect(worldPointerPos, frame.rect)
            )
            if (containingFrame) {
              targetFrameId = containingFrame.id
            }
          }
        }
        
        // Update active frame for visual feedback during drag
        setActiveFrameId(targetFrameId)

        // Handle moving selected items
        const worldDelta = {
          x: deltaX / viewport.zoom,
          y: deltaY / viewport.zoom,
        }

        // Update all selected items
        const updatedDocument = { ...document, updatedAt: new Date().toISOString() }
        let hasChanges = false

        // Use the IDs from moveStartRects (captured at drag start) to avoid stale selection
        const idsToMove = Array.from(rectsForMovement.keys())
        const draggedFrameIds = idsToMove.filter((id) => Boolean(document.frames[id])) as FrameId[]
        const isDraggingFrames = draggedFrameIds.length > 0

        idsToMove.forEach(id => {
          const startRect = rectsForMovement.get(id)
          if (!startRect) return

          const layer = document.layers[id]
          const frame = document.frames[id as any]

          // Skip locked items
          if (layer && layer.flags?.locked) return
          if (frame && frame.flags?.locked) return

          if (layer) {
            const newRect = {
              x: startRect.x + worldDelta.x,
              y: startRect.y + worldDelta.y,
              w: startRect.w,
              h: startRect.h,
            }
            
            updatedDocument.layers = updatedDocument.layers || { ...document.layers }
            updatedDocument.layers[id] = {
              ...layer,
              rect: newRect,
            }
            hasChanges = true
            
            // Handle frame membership based on mouse pointer position
            const currentFrame = document.frames[layer.frameId]
            const isCurrentlyInFrame = currentFrame && currentFrame.childLayerIds.includes(id)
            const isChildOfDraggedFrame = draggedFrameIds.includes(layer.frameId)
            
            if (!isDraggingFrames && !isChildOfDraggedFrame) {
              if (targetFrameId) {
                // Mouse pointer is inside a frame - add layer to that frame
                if (layer.frameId !== targetFrameId || !isCurrentlyInFrame) {
                  // Remove from old frame if it was there
                  if (currentFrame && isCurrentlyInFrame) {
                    updatedDocument.frames = updatedDocument.frames || { ...document.frames }
                    updatedDocument.frames[layer.frameId] = {
                      ...currentFrame,
                      childLayerIds: currentFrame.childLayerIds.filter(lid => lid !== id),
                    }
                  }
                  
                  // Add to target frame if not already there
                  const targetFrame = document.frames[targetFrameId]
                  if (targetFrame && !targetFrame.childLayerIds.includes(id)) {
                    updatedDocument.frames = updatedDocument.frames || { ...document.frames }
                    updatedDocument.frames[targetFrameId] = {
                      ...targetFrame,
                      childLayerIds: [...targetFrame.childLayerIds, id],
                    }
                  }
                  
                  // Update layer frameId
                  updatedDocument.layers[id] = {
                    ...updatedDocument.layers[id],
                    frameId: targetFrameId,
                  }
                }
              } else {
                // Mouse pointer is outside all frames - remove layer from frame (make it free-floating)
                if (currentFrame && isCurrentlyInFrame) {
                  updatedDocument.frames = updatedDocument.frames || { ...document.frames }
                  updatedDocument.frames[layer.frameId] = {
                    ...currentFrame,
                    childLayerIds: currentFrame.childLayerIds.filter(lid => lid !== id),
                  }
                  // Keep frameId for schema compliance (as we do for free-floating layers)
                }
              }
            }
          } else if (frame) {
            updatedDocument.frames = updatedDocument.frames || { ...document.frames }
            updatedDocument.frames[id] = {
              ...frame,
              rect: {
                x: startRect.x + worldDelta.x,
                y: startRect.y + worldDelta.y,
                w: startRect.w,
                h: startRect.h,
              },
            }
            hasChanges = true
          }
        })
       
        if (hasChanges) {
          canvasActions.setDocument(updatedDocument)
        }
      } else {
        // Not dragging yet, clear hover and active frame
        setHoverTargetId(null)
        setActiveFrameId(null)
      }
    } else if (canvas.isSelecting && selectionBoxStartPoint) {
      const selectionRect = updateSelectionBox(pointerPos, width, height)
      setSelectionBoxRect(selectionRect || undefined)
    } else if (!isMouseDown && !isTransforming && !isCreating && document && activePageId && activeTool === 'select') {
      // Hover detection when not dragging/creating/transforming
      const page = document.pages[activePageId]
      if (page) {
        const frames = page.frameIds.map((frameId) => document.frames[frameId]).filter(Boolean)
        const hoverId = hitTest(pointerPos, width, height, 
          Object.fromEntries(frames.map(f => [f.id, f])),
          document.layers
        )
        setHoverTargetId(hoverId)
        
        // Check if hovered layer is clipped and if mouse is inside frame
        if (hoverId && document.layers[hoverId]) {
          const layer = document.layers[hoverId]
          const frame = document.frames[layer.frameId]
          
          // Check if layer is inside a frame (clipped)
          if (frame && frame.childLayerIds.includes(hoverId)) {
            const transform = createViewportTransform(viewport.panX, viewport.panY, viewport.zoom, width, height)
            const worldPoint = screenToWorld(pointerPos, transform)
            const frameRect = frame.rect
            
            // Only show hover if mouse is inside frame bounds
            const isInsideFrame = pointInRect(worldPoint, frameRect)
            if (isInsideFrame) {
              setHoverPart('visible')
            } else {
              // Mouse is outside frame - don't show hover
              setHoverTargetId(null)
              setHoverPart(null)
            }
          } else {
            // Not clipped, so no part distinction
            setHoverPart(null)
          }
        } else {
          setHoverPart(null)
        }
      }
    } else if (isTransforming && selection.selectedIds.length === 1 && document) {
      // Handle transform updates
      const selectedId = selection.selectedIds[0]
      const layer = document.layers[selectedId]
      const frame = document.frames[selectedId as any]
      const target = layer || frame
      
      // Don't allow transforming locked items
      if (target && (layer?.flags?.locked || frame?.flags?.locked)) {
        return
      }
      
      if (target) {
        const newRect = updateTransform(pointerPos, width, height, e.evt.shiftKey)
        if (newRect) {
          // Update the layer/frame rect (this will be handled by command bus later)
          // For now, we'll update directly
          const updatedDocument = {
            ...document,
            updatedAt: new Date().toISOString(),
            ...(layer ? {
              layers: {
                ...document.layers,
                [selectedId]: {
                  ...layer,
                  rect: newRect,
                },
              },
            } : {
              frames: {
                ...document.frames,
                [selectedId]: {
                  ...frame,
                  rect: newRect,
                },
              },
            }),
          }
          canvasActions.setDocument(updatedDocument)
        }
      }
    }
  }, [
    canvas.isPanning,
    canvas.isSelecting,
    isCreating,
    createStartPoint,
    updatePan,
    updateSelectionBox,
    width,
    height,
    isTransforming,
    selection.selectedIds,
    document,
    updateTransform,
    selectionBoxStartPoint,
    isMouseDown,
    activeTool,
    startSelectionBox,
    viewport.panX,
    viewport.panY,
    viewport.zoom,
    moveStartPoint,
    dragTargetIds,
    hasMoved,
    moveStartRects,
    activePageId,
    hitTest,
    hoverTargetId,
  ])

  const handleStageMouseUp = useCallback((e: any) => {
    const stage = e.target.getStage()
    const pointerPos = stage.getPointerPosition()
    
    // Track that mouse button is released
    setIsMouseDown(false)

    if (canvas.isPanning) {
      endPan()
    } else if (isCreating && createStartPoint && pointerPos) {
      // Finish creation with drag
      const minX = Math.min(createStartPoint.x, pointerPos.x)
      const minY = Math.min(createStartPoint.y, pointerPos.y)
      const maxX = Math.max(createStartPoint.x, pointerPos.x)
      const maxY = Math.max(createStartPoint.y, pointerPos.y)
      
      if (Math.abs(maxX - minX) > 5 && Math.abs(maxY - minY) > 5) {
        // Only create if drag was significant
        const dragRect: Rect = {
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
        }
        if (activeTool === 'frame') {
          createFrameAt(dragRect, width, height, 'mobile')
        } else {
          createLayerAt(dragRect, width, height, activeTool)
        }
      }
      setIsCreating(false)
      setCreateStartPoint(null)
      setCreatePreviewRect(undefined)
      setSelectionBoxRect(undefined)
    } else if (selectionBoxStartPoint && !canvas.isSelecting) {
      // Mouse was released without dragging - just clear the start point
      setSelectionBoxStartPoint(null)
      setSelectionBoxRect(undefined)
    } else if (moveStartPoint) {
      const idsToMove = Array.from(moveStartRects.keys())
      const draggedFrameIds = document
        ? (idsToMove.filter((id) => Boolean(document.frames[id])) as FrameId[])
        : []
      const isDraggingFrames = draggedFrameIds.length > 0
      // Handle drop logic - if dropped on a frame, move layer under that frame
      if (!isDraggingFrames && hasMoved && hoverTargetId && document && activePageId) {
        const targetFrame = document.frames[hoverTargetId as any]

        if (targetFrame) {
          // Dropped on a frame - move layers under this frame
          const updatedDocument = { ...document, updatedAt: new Date().toISOString() }
          let hasChanges = false
          
          // Get all frames on the page to check for free-floating layers
          const page = document.pages[activePageId]
          const allFrames = page.frameIds.map((frameId: string) => document.frames[frameId]).filter(Boolean)
          
          idsToMove.forEach(id => {
            const layer = document.layers[id]
            if (!layer) return
            
            // Check if layer is currently free-floating (not in any frame's childLayerIds)
            const isFreeFloating = !allFrames.some((frame: any) => frame.childLayerIds.includes(id))
            
            // Check if layer needs to be moved (different frameId OR free-floating)
            const needsMove = layer.frameId !== hoverTargetId || isFreeFloating
            
            if (needsMove) {
              // Remove from old frame's childLayerIds if it was there
              const oldFrame = document.frames[layer.frameId]
              if (oldFrame && oldFrame.childLayerIds.includes(id)) {
                updatedDocument.frames = updatedDocument.frames || { ...document.frames }
                updatedDocument.frames[layer.frameId] = {
                  ...oldFrame,
                  childLayerIds: oldFrame.childLayerIds.filter(lid => lid !== id),
                }
              }
              
              // Add to new frame's childLayerIds (if not already there)
              if (!targetFrame.childLayerIds.includes(id)) {
                updatedDocument.frames = updatedDocument.frames || { ...document.frames }
                updatedDocument.frames[hoverTargetId] = {
                  ...targetFrame,
                  childLayerIds: [...targetFrame.childLayerIds, id],
                }
              }
              
              // Update layer frameId
              updatedDocument.layers = updatedDocument.layers || { ...document.layers }
              updatedDocument.layers[id] = {
                ...layer,
                frameId: hoverTargetId,
              }
              hasChanges = true
            }
          })
          
          if (hasChanges) {
            canvasActions.setDocument(updatedDocument)
          }
        }
      }
      
      // Only commit movement if we actually moved - if not, revert to original position
      if (!hasMoved && document) {
        // Revert any accidental movement by restoring original positions
        const updatedDocument = { ...document, updatedAt: new Date().toISOString() }
        let hasChanges = false
        
        moveStartRects.forEach((originalRect, id) => {
          const layer = document.layers[id]
          const frame = document.frames[id as any]
          
          if (layer && (layer.rect.x !== originalRect.x || layer.rect.y !== originalRect.y)) {
            updatedDocument.layers = updatedDocument.layers || { ...document.layers }
            updatedDocument.layers[id] = {
              ...layer,
              rect: originalRect,
            }
            hasChanges = true
          } else if (frame && (frame.rect.x !== originalRect.x || frame.rect.y !== originalRect.y)) {
            updatedDocument.frames = updatedDocument.frames || { ...document.frames }
            updatedDocument.frames[id] = {
              ...frame,
              rect: originalRect,
            }
            hasChanges = true
          }
        })
        
        if (hasChanges) {
          canvasActions.setDocument(updatedDocument)
        }
      }
      setIsMoving(false)
      setHasMoved(false)
      setMoveStartPoint(null)
      setMoveStartRects(new Map())
      setHoverTargetId(null)
      setHoverPart(null)
      setActiveFrameId(null)
      setIsMouseDown(false)
    } else if (canvas.isSelecting && pointerPos && document) {
      endSelectionBox(pointerPos, width, height, document.frames, document.layers)
      // Update dragTargetIds to match the new selection after selection box ends
      setDragTargetIds(selection.selectedIds)
      setSelectionBoxStartPoint(null)
      setSelectionBoxRect(undefined)
    } else if (selectionBoxStartPoint) {
      // Clear selection box start point if mouse up without selection
      setSelectionBoxStartPoint(null)
      setSelectionBoxRect(undefined)
    } else if (isTransforming) {
      endTransform()
    }
  }, [
    canvas.isPanning,
    canvas.isSelecting,
    isCreating,
    createStartPoint,
    activeTool,
    endPan,
    endSelectionBox,
    endTransform,
    width,
    height,
    document,
    isTransforming,
    selectionBoxStartPoint,
    isMouseDown,
    startSelectionBox,
    updateSelectionBox,
    viewport.panX,
    viewport.panY,
    viewport.zoom,
    moveStartPoint,
    dragTargetIds,
    moveStartRects,
    hasMoved,
    hoverTargetId,
    activePageId,
    selection.selectedIds,
  ])

  const handleLayerClick = useCallback((layerId: LayerId) => {
    // Only select if select tool is active and layer is not already part of the current selection
    if (activeTool === 'select' && activePageId && !selection.selectedIds.includes(layerId)) {
      select(layerId, activePageId)
    }
  }, [select, activePageId, activeTool, selection.selectedIds])

  const handleFrameClick = useCallback((frameId: FrameId) => {
    // Only select if select tool is active, otherwise let creation tools handle the click
    if (activeTool === 'select' && activePageId && !selection.selectedIds.includes(frameId)) {
      select(frameId, activePageId)
    }
  }, [select, activePageId, activeTool, selection.selectedIds])

  // Calculate selection bounds
  const selectionBounds = document && selection.selectedIds.length > 0
    ? calculateSelectionBounds(selection.selectedIds, document)
    : undefined

  const viewportTransform = createViewportTransform(viewport.panX, viewport.panY, viewport.zoom, width, height)
  const selectionRectScreen = selectionBounds ? viewportTransform.worldRectToScreen(selectionBounds) : undefined

  // Get active page frames
  const activeFrames = document && activePageId
    ? (document.pages[activePageId]?.frameIds || [])
        .map((frameId) => document.frames[frameId])
        .filter(Boolean)
    : []

  // Get layers grouped by frame for clipping
  const frameLayersMap = document && activePageId && activeFrames.length > 0
    ? new Map(
        activeFrames.map((frame) => [
          frame.id,
          frame.childLayerIds
            .map((layerId) => document.layers[layerId])
            .filter(Boolean),
        ])
      )
    : new Map()

  // Get free-floating layers (layers that belong to the page but are not in any frame's childLayerIds)
  const freeFloatingLayers = document && activePageId
    ? Object.values(document.layers).filter((layer) => {
        // Check if layer belongs to this page (by checking if its frameId is in this page's frames)
        const layerFrame = layer.frameId ? document.frames[layer.frameId] : null
        const belongsToPage = layerFrame && activeFrames.some((f) => f.id === layerFrame.id)
        
        if (!belongsToPage) return false
        
        // Check if layer is NOT in any frame's childLayerIds
        const isInAnyFrame = activeFrames.length > 0 && activeFrames.some((frame) => frame.childLayerIds.includes(layer.id))
        return !isInAnyFrame
      })
    : []

  // Combine all layers for selection/hit testing
  const activeLayers = [
    ...Array.from(frameLayersMap.values()).flat(),
    ...freeFloatingLayers,
  ]

  // Handle transform handle drag start
  const handleTransformStart = useCallback((handle: any, e?: any) => {
    if (selection.selectedIds.length === 1 && document) {
      const selectedId = selection.selectedIds[0]
      const layer = document.layers[selectedId]
      const frame = document.frames[selectedId as any]
      const target = layer || frame
      if (target && selectionBounds) {
        const stage = stageRef.current
        const pointerPos = stage?.getPointerPosition() || { x: 0, y: 0 }
        startTransform(handle, selectionBounds, pointerPos, width, height, false)
      }
    }
  }, [selection.selectedIds, document, startTransform, width, height, selectionBounds])

  // Get cursor style based on active tool
  const getCursor = () => {
    if (activeTool === 'pan') return 'grab'
    if (canvas.isPanning) return 'grabbing'
    if (activeTool === 'select') return 'default'
    if (activeTool === 'frame') return 'crosshair'
    if (activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'text' || activeTool === 'image') return 'crosshair'
    return 'default'
  }

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      style={{ cursor: getCursor() }}
      onMouseDown={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
      onMouseLeave={() => {
        setIsMouseDown(false)
        setHoverTargetId(null)
        setHoverPart(null)
        setActiveFrameId(null)
        // Cancel selection box if mouse leaves canvas
        if (canvas.isSelecting) {
          setSelectionBoxRect(undefined)
          setSelectionBoxStartPoint(null)
          canvasActions.setIsSelecting(false)
        }
      }}
      onTouchStart={handleStageMouseDown}
      onTouchMove={handleStageMouseMove}
      onTouchEnd={handleStageMouseUp}
      data-konva-stage="true"
    >
      <KonvaLayer>
        {/* Grid */}
        <Grid
          panX={viewport.panX}
          panY={viewport.panY}
          zoom={viewport.zoom}
          width={width}
          height={height}
          enabled={grid.enabled}
          size={grid.size}
          color={grid.color}
          opacity={grid.opacity}
        />

        {/* Guide Lines */}
        <GuideLines width={width} height={height} />

        {/* Frames */}
        {activeFrames.map((frame) => {
          const transform = createViewportTransform(viewport.panX, viewport.panY, viewport.zoom, width, height)
          const screenRect = transform.worldRectToScreen(frame.rect)
          const frameLayers = frameLayersMap.get(frame.id) || []
          
          // Check if this frame is being dragged (isMoving and frame is in selection)
          const isFrameDragging = isMoving && selection.selectedIds.includes(frame.id)
          
          return (
            <Group key={frame.id}>
              <FrameRenderer
                frame={frame}
                frameId={frame.id}
                panX={viewport.panX}
                panY={viewport.panY}
                zoom={viewport.zoom}
                screenWidth={width}
                screenHeight={height}
                isSelected={selection.selectedIds.includes(frame.id)}
                isHovered={hoverTargetId === frame.id}
                isActive={activeFrameId === frame.id && isMoving}
                onClick={handleFrameClick}
              />
              {/* Frame layers with clipping */}
              <Group
                clipFunc={(ctx) => {
                  ctx.beginPath()
                  ctx.rect(screenRect.x, screenRect.y, screenRect.w, screenRect.h)
                  ctx.clip()
                }}
              >
                {frameLayers.map((layer) => (
                  <LayerRenderer
                    key={layer.id}
                    layer={layer}
                    layerId={layer.id}
                    panX={viewport.panX}
                    panY={viewport.panY}
                    zoom={viewport.zoom}
                    screenWidth={width}
                    screenHeight={height}
                    isSelected={selection.selectedIds.includes(layer.id)}
                    isHovered={hoverTargetId === layer.id && hoverPart === 'visible'}
                    tokens={document?.tokens}
                    onClick={handleLayerClick}
                    clipRect={screenRect}
                    isGrayedOut={isFrameDragging}
                  />
                ))}
              </Group>
              {/* Hover borders for hidden parts of clipped layers (outside clipping) */}
              {frameLayers.map((layer) => {
                // Check if layer extends beyond frame bounds
                const layerScreenRect = transform.worldRectToScreen(layer.rect)
                const extendsBeyondFrame = 
                  layerScreenRect.x < screenRect.x ||
                  layerScreenRect.y < screenRect.y ||
                  layerScreenRect.x + layerScreenRect.w > screenRect.x + screenRect.w ||
                  layerScreenRect.y + layerScreenRect.h > screenRect.y + screenRect.h
                
                const isSelected = selection.selectedIds.includes(layer.id)
                const isHovered = hoverTargetId === layer.id && hoverPart === 'visible'
                
                // Show hidden part border when hovering over visible part
                if (isHovered && extendsBeyondFrame) {
                  return (
                    <LayerRenderer
                      key={`${layer.id}-hidden-hover-border`}
                      layer={layer}
                      layerId={layer.id}
                      panX={viewport.panX}
                      panY={viewport.panY}
                      zoom={viewport.zoom}
                      screenWidth={width}
                      screenHeight={height}
                      isSelected={false}
                      isHovered={true}
                      tokens={document?.tokens}
                      onClick={handleLayerClick}
                      clipRect={screenRect}
                      showHiddenPartBorder={true}
                      isGrayedOut={isFrameDragging}
                    />
                  )
                }
                
                // Show hidden part border when selected
                if (isSelected && extendsBeyondFrame) {
                  return (
                    <LayerRenderer
                      key={`${layer.id}-hidden-selected-border`}
                      layer={layer}
                      layerId={layer.id}
                      panX={viewport.panX}
                      panY={viewport.panY}
                      zoom={viewport.zoom}
                      screenWidth={width}
                      screenHeight={height}
                      isSelected={true}
                      isHovered={false}
                      tokens={document?.tokens}
                      onClick={handleLayerClick}
                      clipRect={screenRect}
                      showHiddenPartBorder={true}
                      isGrayedOut={isFrameDragging}
                    />
                  )
                }
                
                return null
              })}
            </Group>
          )
        })}

        {/* Free-floating layers (no clipping) */}
        {freeFloatingLayers.map((layer) => (
          <LayerRenderer
            key={layer.id}
            layer={layer}
            layerId={layer.id}
            panX={viewport.panX}
            panY={viewport.panY}
            zoom={viewport.zoom}
            screenWidth={width}
            screenHeight={height}
            isSelected={selection.selectedIds.includes(layer.id)}
            isHovered={hoverTargetId === layer.id}
            tokens={document?.tokens}
            onClick={handleLayerClick}
          />
        ))}

        {selectionRectScreen && (
          <KonvaRect
            x={selectionRectScreen.x - 1}
            y={selectionRectScreen.y - 1}
            width={selectionRectScreen.w + 2}
            height={selectionRectScreen.h + 2}
            stroke="#0066ff"
            strokeWidth={1}
            dash={[6, 4]}
            fill="rgba(0, 102, 255, 0.04)"
            listening={false}
          />
        )}

        {/* Creation preview */}
        {isCreating && createPreviewRect && (
          <CreationPreview
            rect={createPreviewRect}
            tool={activeTool}
            panX={viewport.panX}
            panY={viewport.panY}
            zoom={viewport.zoom}
            screenWidth={width}
            screenHeight={height}
          />
        )}

        {/* Selection box */}
        {canvas.isSelecting && selectionBoxRect && !isCreating && (
          <SelectionBox
            rect={selectionBoxRect}
            panX={viewport.panX}
            panY={viewport.panY}
            zoom={viewport.zoom}
            screenWidth={width}
            screenHeight={height}
          />
        )}

        {/* Transform handles */}
        {selectionBounds && selection.selectedIds.length === 1 && !isCreating && (() => {
          // Don't show transform handles for locked items
          const selectedId = selection.selectedIds[0]
          const layer = document?.layers[selectedId]
          const frame = document?.frames[selectedId as any]
          const isLocked = layer?.flags?.locked || frame?.flags?.locked
          
          if (isLocked) return null
          
          return (
            <TransformHandles
              rect={selectionBounds}
              panX={viewport.panX}
              panY={viewport.panY}
              zoom={viewport.zoom}
              screenWidth={width}
              screenHeight={height}
              onHandleDragStart={handleTransformStart}
            />
          )
        })()}
      </KonvaLayer>
    </Stage>
  )
}
