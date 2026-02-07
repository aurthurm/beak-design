# Canvas System

## Overview

The Canvas System provides the core rendering and interaction layer for the design editor. It's built on Konva.js and manages document state, selection, transformations, and viewport.

## Architecture

```
Canvas Store (TanStack Store)
    ↓
Canvas Components (React)
    ↓
Konva Stage & Layers
    ↓
Browser Canvas API
```

## Core Components

### 1. Canvas Store (`src/lib/canvas/store.ts`)

**Purpose**: Central state management for canvas

**State Structure**:
```typescript
{
  // Document state
  document: Document | null
  activePageId: PageId | null
  
  // Viewport state
  panX: number
  panY: number
  zoom: number
  
  // Selection state
  selection: SelectionState
  
  // Interaction state
  interactionMode: InteractionMode
  currentTool: ToolType
  
  // UI state
  gridSettings: GridSettings
  snapSettings: SnapSettings
  guides: GuideLine[]
  
  // Save status
  saveStatus: SaveStatus
}
```

**Usage**:
```typescript
import { canvasStore, canvasActions } from '@/lib/canvas/store'

// Read state
const state = canvasStore.state
const document = state.document

// Update state
canvasActions.setDocument(newDocument)
canvasActions.setSelection(selection)
canvasActions.setZoom(1.5)
```

### 2. KonvaStage Component (`src/components/canvas/KonvaStage.tsx`)

**Purpose**: Root Konva stage component

**Features**:
- Stage initialization
- Event handling (mouse, keyboard)
- Viewport management
- Grid and guides rendering
- Selection box rendering

**Props**:
```typescript
{
  width: number
  height: number
  onStageClick?: (e: KonvaEventObject<MouseEvent>) => void
  onStageDrag?: (e: KonvaEventObject<DragEvent>) => void
}
```

### 3. FrameRenderer (`src/components/canvas/FrameRenderer.tsx`)

**Purpose**: Renders frames (artboards)

**Features**:
- Frame boundaries
- Frame labels
- Selection highlighting
- Hover effects

**Usage**:
```typescript
<FrameRenderer
  frame={frame}
  isSelected={isSelected}
  onSelect={(e) => handleSelect(frame.id)}
/>
```

### 4. LayerRenderer (`src/components/canvas/LayerRenderer.tsx`)

**Purpose**: Renders individual layers

**Features**:
- Type-specific rendering (rect, text, image, etc.)
- Transform handles
- Selection highlighting
- Hover effects

**Layer Types**:
- `rect`: Rectangle shapes
- `text`: Text elements
- `image`: Image elements
- `ellipse`: Ellipse/circle shapes
- `line`: Line paths
- `group`: Group containers

### 5. Selection System (`src/lib/canvas/selection.ts`)

**Purpose**: Manages selection state and operations

**Features**:
- Single and multi-select
- Selection box (marquee)
- Selection persistence
- Selection-based operations

**Usage**:
```typescript
import { selectionActions } from '@/lib/canvas/selection'

// Select single item
selectionActions.selectSingle(layerId)

// Select multiple
selectionActions.selectMultiple([id1, id2, id3])

// Clear selection
selectionActions.clearSelection()

// Get selection
const selected = canvasStore.state.selection.selectedIds
```

### 6. Transform Handles (`src/components/canvas/TransformHandles.tsx`)

**Purpose**: Visual handles for transforming selected elements

**Features**:
- Resize handles (8 corners/edges)
- Rotate handle
- Move cursor
- Snap to grid/guides

**Handle Types**:
- Corner handles: Resize maintaining aspect ratio (with Shift)
- Edge handles: Resize one dimension
- Rotate handle: Rotate around center
- Move area: Drag to move

### 7. Viewport Management (`src/lib/canvas/viewport.ts`)

**Purpose**: Manages pan, zoom, and viewport state

**Features**:
- Pan (drag canvas)
- Zoom (mouse wheel, pinch)
- Fit to selection
- Fit to frame
- Reset viewport

**Usage**:
```typescript
import { viewportActions } from '@/lib/canvas/viewport'

// Pan
viewportActions.pan(deltaX, deltaY)

// Zoom
viewportActions.zoom(factor, centerX, centerY)

// Fit to selection
viewportActions.fitToSelection()

// Reset
viewportActions.reset()
```

## Canvas Hooks

### useCanvas (`src/lib/canvas/hooks/useCanvas.ts`)

**Purpose**: Main canvas hook providing canvas functionality

**Returns**:
```typescript
{
  document: Document | null
  activePage: Page | null
  selectedIds: string[]
  zoom: number
  pan: { x: number, y: number }
  // ... actions
}
```

### usePanZoom (`src/lib/canvas/hooks/usePanZoom.ts`)

**Purpose**: Pan and zoom interactions

**Features**:
- Mouse wheel zoom
- Pan with space+drag
- Pinch zoom (touch)
- Zoom limits

### useSelection (`src/lib/canvas/hooks/useSelection.ts`)

**Purpose**: Selection interactions

**Features**:
- Click to select
- Shift+click for multi-select
- Marquee selection
- Keyboard selection (arrow keys)

### useTransform (`src/lib/canvas/hooks/useTransform.ts`)

**Purpose**: Transform interactions

**Features**:
- Drag to move
- Resize handles
- Rotate handle
- Snap to grid/guides

### useKeyboardShortcuts (`src/lib/canvas/hooks/useKeyboardShortcuts.ts`)

**Purpose**: Keyboard shortcuts

**Shortcuts**:
- `Delete/Backspace`: Delete selected
- `Cmd/Ctrl+C`: Copy
- `Cmd/Ctrl+V`: Paste
- `Cmd/Ctrl+Z`: Undo
- `Cmd/Ctrl+Shift+Z`: Redo
- `Cmd/Ctrl+A`: Select all
- `Cmd/Ctrl+D`: Duplicate
- `Arrow keys`: Nudge selection
- `Space+Drag`: Pan
- `Cmd/Ctrl+Scroll`: Zoom

## Document Model

### Document Structure

```typescript
{
  id: DocumentId
  name: string
  schemaVersion: string
  createdAt: string
  updatedAt: string
  activePageId: PageId
  
  pages: Record<PageId, Page>
  frames: Record<FrameId, Frame>
  layers: Record<LayerId, Layer>
  components: Record<ComponentId, Component>
  tokens: Record<TokenId, Token>
  assets: Record<AssetId, Asset>
}
```

### Page Structure

```typescript
{
  id: PageId
  documentId: DocumentId
  name: string
  frameIds: FrameId[]
  provenance: {
    createdAt: string
    createdBy: Actor
    updatedAt?: string
    updatedBy?: Actor
  }
}
```

### Frame Structure

```typescript
{
  id: FrameId
  pageId: PageId
  name: string
  platform: 'mobile' | 'tablet' | 'desktop' | 'custom'
  rect: { x: number, y: number, w: number, h: number }
  childLayerIds: LayerId[]
  provenance: Provenance
}
```

### Layer Structure

```typescript
{
  id: LayerId
  frameId: FrameId
  type: LayerType
  name: string
  rect: { x: number, y: number, w: number, h: number }
  rotation: number
  style: StyleProperties
  // ... type-specific properties
}
```

## Coordinate System

### World Coordinates
- Origin at (0, 0) top-left
- Units in pixels
- Used for document storage

### Viewport Coordinates
- Relative to viewport
- Affected by pan/zoom
- Used for mouse events

### Conversion Utilities (`src/lib/canvas/utils/coordinates.ts`)

```typescript
// World to viewport
const viewportPos = worldToViewport(worldX, worldY, pan, zoom)

// Viewport to world
const worldPos = viewportToWorld(viewportX, viewportY, pan, zoom)

// Screen to viewport
const viewportPos = screenToViewport(screenX, screenY, stage)
```

## Grid & Snap System

### Grid (`src/components/canvas/Grid.tsx`)

**Features**:
- Configurable grid size
- Grid visibility toggle
- Grid color/opacity
- Snap to grid

**Settings**:
```typescript
{
  enabled: boolean
  size: number        // Grid cell size in pixels
  color: string
  opacity: number
}
```

### Snap (`src/lib/canvas/utils/snap.ts`)

**Features**:
- Snap to grid
- Snap to guides
- Snap to other objects
- Snap threshold

**Usage**:
```typescript
import { snapToGrid, snapToGuides } from '@/lib/canvas/utils/snap'

const snappedX = snapToGrid(x, gridSize)
const { x: snappedX, y: snappedY } = snapToGuides(x, y, guides)
```

## Undo/Redo System

### UndoRedo Manager (`src/lib/canvas/undo-redo.ts`)

**Purpose**: Manages undo/redo history

**Features**:
- Command history
- Undo/redo operations
- History limits
- Transaction grouping

**Usage**:
```typescript
import { undoRedoActions } from '@/lib/canvas/undo-redo'

// Undo
undoRedoActions.undo()

// Redo
undoRedoActions.redo()

// Check if undo/redo available
const canUndo = undoRedoActions.canUndo()
const canRedo = undoRedoActions.canRedo()
```

## Animation System

### Animation Manager (`src/lib/canvas/animations.ts`)

**Purpose**: Visual feedback animations

**Animation Types**:
- `flash`: Quick highlight flash
- `pulse`: Oscillating pulse
- `highlight`: Fade-out highlight

**Usage**:
```typescript
import { getAnimationManager } from '@/lib/canvas/animations'

const manager = getAnimationManager()
manager.flashNode(nodeId, '#0066ff', 500)
manager.pulseNode(nodeId, '#0066ff', 1000)
manager.highlightNode(nodeId, '#0066ff', 2000)
```

## Export System

### Konva Exporter (`src/lib/export/konva-exporter.ts`)

**Purpose**: Export frames/layers to images

**Features**:
- PNG export
- SVG export (planned)
- Resolution scaling
- Quality settings

**Usage**:
```typescript
import { getKonvaExporter } from '@/lib/export/konva-exporter'

const exporter = getKonvaExporter()
const result = await exporter.exportFrameToPNG(frameId, scale, maxResolution)
// Returns: { mimeType: 'image/png', bytesBase64: string }
```

## Best Practices

### 1. Always Use Store Actions
Never mutate store state directly:

```typescript
// ✅ Good
canvasActions.setDocument(doc)

// ❌ Bad
canvasStore.state.document = doc
```

### 2. Use Hooks for Interactions
Leverage canvas hooks for common operations:

```typescript
const { selectedIds, selectSingle } = useSelection()
```

### 3. Handle Coordinate Conversion
Always convert between coordinate systems:

```typescript
const worldPos = viewportToWorld(event.evt.clientX, event.evt.clientY, pan, zoom)
```

### 4. Batch Updates
Group related updates:

```typescript
canvasStore.setState((state) => ({
  ...state,
  panX: newX,
  panY: newY,
  zoom: newZoom
}))
```

### 5. Clean Up Event Listeners
Remove listeners on unmount:

```typescript
useEffect(() => {
  const handler = () => { /* ... */ }
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])
```

## Performance Optimization

### 1. Virtual Rendering
Only render visible frames/layers

### 2. Debounce Updates
Debounce rapid state changes

### 3. Memoize Components
Use React.memo for expensive renders

### 4. Layer Caching
Cache rendered layers when unchanged

### 5. Request Animation Frame
Use RAF for smooth animations

## Related Documentation

- [Command Bus](./04-command-bus.md) - Document mutations
- [Agent Integration](./01-agent-integration.md) - AI interactions
- [Architecture Overview](./00-architecture-overview.md) - System architecture
