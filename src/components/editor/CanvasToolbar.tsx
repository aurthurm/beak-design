import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Square,
  Type,
  Image,
  Circle,
  Frame,
  Undo2,
  Redo2,
  Hand,
  ChevronDown,
} from 'lucide-react'
import { useState, useEffect } from 'react'

export type ToolType = 'select' | 'pan' | 'frame' | 'rect' | 'text' | 'image' | 'ellipse'
type ShapeToolType = 'rect' | 'ellipse'

interface CanvasToolbarProps {
  activeTool: ToolType
  onToolChange: (tool: ToolType) => void
}

export function CanvasToolbar({ activeTool, onToolChange }: CanvasToolbarProps) {
  const [lastShapeTool, setLastShapeTool] = useState<ShapeToolType>('rect')

  // Track last used shape tool
  useEffect(() => {
    if (activeTool === 'rect' || activeTool === 'ellipse') {
      setLastShapeTool(activeTool)
    }
  }, [activeTool])

  const getShapeIcon = (tool: ShapeToolType) => {
    switch (tool) {
      case 'rect':
        return <Square className="w-3.5 h-3.5" />
      case 'ellipse':
        return <Circle className="w-3.5 h-3.5" />
    }
  }

  const getShapeLabel = (tool: ShapeToolType) => {
    switch (tool) {
      case 'rect':
        return 'Rectangle'
      case 'ellipse':
        return 'Ellipse'
    }
  }

  const handleShapeSelect = (tool: ShapeToolType) => {
    setLastShapeTool(tool)
    onToolChange(tool)
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-background shadow-md w-fit">
      {/* Tools */}
      <div className="flex items-center gap-0.5">
        <Button
          variant={activeTool === 'select' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onToolChange('select')}
          title="Select (V)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 2L8 14L10 10L14 12L2 2Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
        </Button>
        <Button
          variant={activeTool === 'pan' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onToolChange('pan')}
          title="Pan (H)"
        >
          <Hand className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={activeTool === 'frame' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onToolChange('frame')}
          title="Frame (F)"
        >
          <Frame className="w-3.5 h-3.5" />
        </Button>
        
        {/* Shapes dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={(activeTool === 'rect' || activeTool === 'ellipse') ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-1.5 gap-0.5"
              title="Shapes"
            >
              {getShapeIcon(lastShapeTool)}
              <ChevronDown className="w-2.5 h-2.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto min-w-fit">
            <DropdownMenuItem
              onClick={() => handleShapeSelect('rect')}
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              <span>Rectangle</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleShapeSelect('ellipse')}
              className="flex items-center gap-2"
            >
              <Circle className="w-4 h-4" />
              <span>Ellipse</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button
          variant={activeTool === 'text' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onToolChange('text')}
          title="Text (T)"
        >
          <Type className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={activeTool === 'image' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onToolChange('image')}
          title="Image (I)"
        >
          <Image className="w-3.5 h-3.5" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Undo (Ctrl+Z)"
          onClick={async () => {
            const { getUndoRedoManager } = await import('@/lib/canvas/undo-redo')
            const undoRedo = getUndoRedoManager()
            undoRedo.undo()
          }}
        >
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Redo (Ctrl+Shift+Z)"
          onClick={async () => {
            const { getUndoRedoManager } = await import('@/lib/canvas/undo-redo')
            const undoRedo = getUndoRedoManager()
            undoRedo.redo()
          }}
        >
          <Redo2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
