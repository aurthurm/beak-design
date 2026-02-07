import { useStore } from '@tanstack/react-store'
import { canvasStore } from '../store'
import { usePanZoom } from './usePanZoom'
import { useSelection } from './useSelection'
import { useTransform } from './useTransform'

/**
 * Main canvas hook that combines all canvas functionality
 */
export function useCanvas() {
  const state = useStore(canvasStore)
  const panZoom = usePanZoom()
  const selection = useSelection()
  const transform = useTransform()

  return {
    // State
    document: state.document,
    activePageId: state.activePageId,
    viewport: {
      panX: state.panX,
      panY: state.panY,
      zoom: state.zoom,
      minZoom: state.minZoom,
      maxZoom: state.maxZoom,
    },
    grid: state.grid,
    snap: state.snap,
    interactionMode: state.interactionMode,
    activeTool: state.activeTool,

    // Pan/Zoom
    ...panZoom,

    // Selection
    ...selection,

    // Transform
    ...transform,
  }
}
