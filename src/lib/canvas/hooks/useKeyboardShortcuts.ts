import { useEffect } from 'react'
import { canvasActions, canvasStore } from '../store'
import type { ToolType } from '../store'

/**
 * Keyboard shortcuts handler for canvas tools
 * Based on reference implementation patterns
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs/textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey
      const shift = e.shiftKey
      const alt = e.altKey

      // Tool shortcuts (only when not holding modifiers except shift)
      if (!cmdOrCtrl && !alt) {
        switch (e.key.toLowerCase()) {
          case 'v':
            if (!shift) {
              e.preventDefault()
              canvasActions.setActiveTool('select')
            }
            break
          case 'h':
            if (!shift) {
              e.preventDefault()
              canvasActions.setActiveTool('pan')
            }
            break
          case 'r':
            if (!shift) {
              e.preventDefault()
              canvasActions.setActiveTool('rect')
            }
            break
          case 'o':
            if (!shift) {
              e.preventDefault()
              canvasActions.setActiveTool('ellipse')
            }
            break
          case 'f':
          case 'a':
            if (!shift) {
              e.preventDefault()
              canvasActions.setActiveTool('frame')
            }
            break
          case 't':
            if (!shift) {
              e.preventDefault()
              canvasActions.setActiveTool('text')
            }
            break
          case 'i':
            if (!shift) {
              e.preventDefault()
              canvasActions.setActiveTool('image')
            }
            break
        }
      }

      // Delete selection
      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        !cmdOrCtrl &&
        !shift &&
        !alt
      ) {
        const state = canvasStore.state
        if (state.selection.selectedIds.length > 0) {
          e.preventDefault()
          // TODO: Implement delete command
          console.log('Delete selected:', state.selection.selectedIds)
        }
      }

      // Clear selection with Escape
      if (e.key === 'Escape' && !cmdOrCtrl && !shift && !alt) {
        const state = canvasStore.state
        if (state.selection.selectedIds.length > 0) {
          e.preventDefault()
          canvasActions.clearSelection()
        }
      }

      // Select all
      if (cmdOrCtrl && e.key === 'a' && !shift && !alt) {
        e.preventDefault()
        // TODO: Implement select all
        console.log('Select all')
      }

      // Undo/Redo
      if (cmdOrCtrl && e.key === 'z' && !shift && !alt) {
        e.preventDefault()
        const { getUndoRedoManager } = await import('../undo-redo')
        const undoRedo = getUndoRedoManager()
        undoRedo.undo()
      }

      if (cmdOrCtrl && (e.key === 'y' || (e.key === 'z' && shift)) && !alt) {
        e.preventDefault()
        const { getUndoRedoManager } = await import('../undo-redo')
        const undoRedo = getUndoRedoManager()
        undoRedo.redo()
      }

      // Copy/Cut/Paste
      if (cmdOrCtrl && e.key === 'c' && !shift && !alt) {
        e.preventDefault()
        // TODO: Implement copy
        console.log('Copy')
      }

      if (cmdOrCtrl && e.key === 'x' && !shift && !alt) {
        e.preventDefault()
        // TODO: Implement cut
        console.log('Cut')
      }

      if (cmdOrCtrl && e.key === 'v' && !shift && !alt) {
        e.preventDefault()
        // TODO: Implement paste
        console.log('Paste')
      }

      // Group/Ungroup
      if (cmdOrCtrl && e.key === 'g' && !shift && !alt) {
        e.preventDefault()
        // TODO: Implement group
        console.log('Group')
      }

      if (cmdOrCtrl && shift && e.key === 'g' && !alt) {
        e.preventDefault()
        // TODO: Implement ungroup
        console.log('Ungroup')
      }

      // Arrow keys for pixel movement
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        !cmdOrCtrl &&
        !alt
      ) {
        const state = canvasStore.state
        if (state.selection.selectedIds.length > 0) {
          e.preventDefault()
          const step = shift ? 10 : 1
          let deltaX = 0
          let deltaY = 0

          switch (e.key) {
            case 'ArrowUp':
              deltaY = -step
              break
            case 'ArrowDown':
              deltaY = step
              break
            case 'ArrowLeft':
              deltaX = -step
              break
            case 'ArrowRight':
              deltaX = step
              break
          }

          // TODO: Implement move command
          console.log('Move selection:', { deltaX, deltaY })
        }
      }

      // Zoom shortcuts
      if (!cmdOrCtrl && !alt) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault()
            const currentZoom = canvasStore.state.zoom
            canvasActions.setZoom(Math.min(currentZoom * 1.2, canvasStore.state.maxZoom))
            break
          case '-':
          case '_':
            e.preventDefault()
            const currentZoomOut = canvasStore.state.zoom
            canvasActions.setZoom(Math.max(currentZoomOut / 1.2, canvasStore.state.minZoom))
            break
          case '0':
            e.preventDefault()
            canvasActions.setZoom(1)
            break
          case '1':
            e.preventDefault()
            // TODO: Implement zoom to fit
            console.log('Zoom to fit')
            break
          case '2':
            e.preventDefault()
            // TODO: Implement zoom to selection
            console.log('Zoom to selection')
            break
        }
      }

      // Toggle grid
      if (cmdOrCtrl && e.key === "'" && !shift && !alt) {
        e.preventDefault()
        const state = canvasStore.state
        canvasActions.setGrid({ enabled: !state.grid.enabled })
      }

      // Toggle snap to grid
      if (cmdOrCtrl && shift && e.key === "'" && !alt) {
        e.preventDefault()
        const state = canvasStore.state
        canvasActions.setSnap({ grid: !state.snap.grid })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}
