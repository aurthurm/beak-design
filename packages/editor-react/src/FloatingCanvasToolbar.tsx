import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Home,
} from 'lucide-react'
import { useCanvas } from '@/lib/canvas/hooks/useCanvas'
import { canvasActions } from '@/lib/canvas/store'

export function FloatingCanvasToolbar() {
  const canvas = useCanvas()

  const handleZoomIn = () => {
    canvasActions.setZoom(canvas.viewport.zoom * 1.2)
  }

  const handleZoomOut = () => {
    canvasActions.setZoom(canvas.viewport.zoom / 1.2)
  }

  const handleZoomFit = () => {
    if (canvas.document && canvas.activePageId) {
      const page = canvas.document.pages[canvas.activePageId]
      if (page && page.frameIds.length > 0) {
        const frames = page.frameIds.map(id => canvas.document!.frames[id]).filter(Boolean)
        if (frames.length > 0) {
          // Calculate bounds of all frames
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          frames.forEach(frame => {
            minX = Math.min(minX, frame.rect.x)
            minY = Math.min(minY, frame.rect.y)
            maxX = Math.max(maxX, frame.rect.x + frame.rect.w)
            maxY = Math.max(maxY, frame.rect.y + frame.rect.h)
          })
          const bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
          canvas.zoomToFit(bounds, window.innerWidth, window.innerHeight)
        }
      }
    }
  }

  const handleResetCanvas = () => {
    // Reset pan to origin (0, 0) while keeping current zoom
    canvasActions.setViewport(0, 0, canvas.viewport.zoom)
  }

  const toggleGrid = () => {
    canvasActions.setGrid({ enabled: !canvas.grid.enabled })
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-background shadow-lg">
        {/* Reset Canvas */}
        <Button 
          variant="ghost" 
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleResetCanvas}
          title="Reset Canvas Position (0, 0)"
        >
          <Home className="w-3.5 h-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5" />

        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[50px] text-center">
            {Math.round(canvas.viewport.zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomFit} title="Fit to Screen">
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* Grid toggle */}
        <Button
          variant={canvas.grid.enabled ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={toggleGrid}
          title="Toggle Grid"
        >
          <Grid className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
