import { useRef, useEffect, useState } from 'react'
import { KonvaStage } from './KonvaStage'
import { Ruler } from './Ruler'
import { useSidebar } from '@/components/ui/sidebar'
import { useKeyboardShortcuts } from '@/lib/canvas/hooks/useKeyboardShortcuts'
import { cn } from '@/lib/utils'

interface CanvasViewportProps {
  className?: string
}

const SIDEBAR_WIDTH_EXPANDED = 256 // 16rem = 256px
const SIDEBAR_WIDTH_COLLAPSED = 48 // 3rem = 48px

export function CanvasViewport({ className }: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { state } = useSidebar()
  // Use safe defaults for SSR - will be updated in useEffect on client
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isMounted, setIsMounted] = useState(false)
  
  // Enable keyboard shortcuts for canvas tools
  useKeyboardShortcuts()

  useEffect(() => {
    // Mark as mounted on client side
    setIsMounted(true)
    
    // Only access window on client side
    if (typeof window === 'undefined') return
    
    const updateDimensions = () => {
      // Use full window dimensions - canvas fills the entire viewport
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Calculate sidebar width based on state - use safe default for SSR
  const sidebarWidth = isMounted && state === 'expanded' ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED

  return (
    <div
      ref={containerRef}
      data-canvas-viewport="true"
      className={cn('absolute inset-0 w-full h-full overflow-hidden', className)}
      style={{
        backgroundColor: '#E8E9EA', // Light gray canvas background
      }}
    >
      {isMounted && dimensions.width > 0 && dimensions.height > 0 && (
        <>
          <Ruler 
            width={dimensions.width} 
            height={dimensions.height} 
            sidebarWidth={sidebarWidth}
          />
          <KonvaStage width={dimensions.width} height={dimensions.height} />
        </>
      )}
    </div>
  )
}
