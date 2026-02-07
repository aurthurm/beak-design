import { useCallback, useRef } from 'react'
import { useStore } from '@tanstack/react-store'
import { canvasStore, canvasActions } from '../store'
import { createViewportTransform } from '../viewport'
import type { Point, Rect } from '../../schema'

export function usePanZoom() {
  const state = useStore(canvasStore)
  const isDraggingRef = useRef(false)
  const lastPanPointRef = useRef<Point | null>(null)

  const pan = useCallback((deltaX: number, deltaY: number) => {
    canvasActions.setViewport(
      state.panX + deltaX / state.zoom,
      state.panY + deltaY / state.zoom
    )
  }, [state.panX, state.panY, state.zoom])

  const zoom = useCallback((delta: number, screenPoint?: Point) => {
    const newZoom = state.zoom * (1 + delta)
    
    if (screenPoint) {
      const transform = createViewportTransform(
        state.panX,
        state.panY,
        state.zoom,
        0, // Will be set by caller
        0
      )
      const { panX, panY, zoom: finalZoom } = transform.zoomAtPoint(newZoom, screenPoint)
      canvasActions.setViewport(panX, panY, finalZoom)
    } else {
      canvasActions.setZoom(newZoom)
    }
  }, [state.zoom, state.panX, state.panY])

  const zoomToFit = useCallback((rect: Rect, screenWidth: number, screenHeight: number) => {
    const transform = createViewportTransform(
      state.panX,
      state.panY,
      state.zoom,
      screenWidth,
      screenHeight
    )
    const { panX, panY, zoom: newZoom } = transform.zoomToFit(rect)
    canvasActions.setViewport(panX, panY, newZoom)
  }, [state.panX, state.panY, state.zoom])

  const startPan = useCallback((screenPoint: Point) => {
    isDraggingRef.current = true
    lastPanPointRef.current = screenPoint
    canvasActions.setIsPanning(true)
  }, [])

  const updatePan = useCallback((screenPoint: Point) => {
    if (!isDraggingRef.current || !lastPanPointRef.current) return
    
    const deltaX = screenPoint.x - lastPanPointRef.current.x
    const deltaY = screenPoint.y - lastPanPointRef.current.y
    
    pan(deltaX, deltaY)
    lastPanPointRef.current = screenPoint
  }, [pan])

  const endPan = useCallback(() => {
    isDraggingRef.current = false
    lastPanPointRef.current = null
    canvasActions.setIsPanning(false)
  }, [])

  const handleWheel = useCallback((e: WheelEvent, screenWidth: number, screenHeight: number) => {
    e.preventDefault()
    
    const delta = -e.deltaY * 0.001
    const screenPoint = { x: e.clientX, y: e.clientY }
    
    zoom(delta, screenPoint)
  }, [zoom])

  return {
    pan,
    zoom,
    zoomToFit,
    startPan,
    updatePan,
    endPan,
    handleWheel,
    isPanning: state.isPanning,
  }
}
