import { useState, useRef, useCallback, useEffect } from 'react'

export type Corner = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

interface UseDraggablePanelOptions {
  defaultWidth: number
  defaultHeight: number
  defaultCorner: Corner
  rightOffset?: number
  leftOffset?: number
  toolbarWidth?: number
  storageKey?: string
}

export function useDraggablePanel({
  defaultWidth,
  defaultHeight,
  defaultCorner,
  rightOffset = 0,
  leftOffset = 0,
  toolbarWidth = 0,
  storageKey,
}: UseDraggablePanelOptions) {
  const [corner, setCorner] = useState<Corner>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`${storageKey}-corner`)
      if (stored && ['bottom-left', 'bottom-right', 'top-left', 'top-right'].includes(stored)) {
        return stored as Corner
      }
    }
    return defaultCorner
  })

  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)

  const getPositionStyle = useCallback((): React.CSSProperties => {
    const isLeft = corner === 'bottom-left' || corner === 'top-left'
    const isBottom = corner === 'bottom-left' || corner === 'bottom-right'

    return {
      position: 'absolute',
      [isLeft ? 'left' : 'right']: isLeft ? `${leftOffset + toolbarWidth}px` : `${rightOffset}px`,
      [isBottom ? 'bottom' : 'top']: '16px',
    }
  }, [corner, leftOffset, rightOffset, toolbarWidth])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    dragStartPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartPos.current) return

      const deltaX = e.clientX - dragStartPos.current.x
      const deltaY = e.clientY - dragStartPos.current.y

      // Simple drag - could add corner snapping logic here
      // For now, just track dragging state
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartPos.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`${storageKey}-corner`, corner)
    }
  }, [corner, storageKey])

  return {
    corner,
    setCorner,
    isDragging,
    positionStyle: getPositionStyle(),
    dragHandleProps: {
      onMouseDown: handleMouseDown,
    },
  }
}
