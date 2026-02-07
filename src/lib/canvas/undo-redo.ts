import type { Document } from '../schema'
import { canvasStore, canvasActions } from './store'

/**
 * Undo/Redo system using document snapshots
 * Tracks document state history for undo/redo operations
 */
export class UndoRedoManager {
  private undoStack: DocumentSnapshot[] = []
  private redoStack: DocumentSnapshot[] = []
  private maxHistorySize: number = 50
  isUndoing: boolean = false
  isRedoing: boolean = false

  /**
   * Save current document state to undo stack
   * Called before making changes
   */
  saveSnapshot(): void {
    if (this.isUndoing || this.isRedoing) return

    const state = canvasStore.state
    if (!state.document) return

    // Create snapshot
    const snapshot: DocumentSnapshot = {
      document: JSON.parse(JSON.stringify(state.document)), // Deep clone
      timestamp: Date.now(),
    }

    this.undoStack.push(snapshot)

    // Limit stack size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift()
    }

    // Clear redo stack when new change is made
    this.redoStack = []
  }

  /**
   * Undo last change
   */
  undo(): boolean {
    if (this.undoStack.length === 0) {
      return false
    }

    // Save current state to redo stack
    const currentState = canvasStore.state
    if (currentState.document) {
      this.redoStack.push({
        document: JSON.parse(JSON.stringify(currentState.document)),
        timestamp: Date.now(),
      })
    }

    // Restore previous state
    const snapshot = this.undoStack.pop()!
    this.isUndoing = true
    canvasActions.setDocument(snapshot.document)
    this.isUndoing = false

    return true
  }

  /**
   * Redo last undone change
   */
  redo(): boolean {
    if (this.redoStack.length === 0) {
      return false
    }

    // Save current state to undo stack
    const currentState = canvasStore.state
    if (currentState.document) {
      this.undoStack.push({
        document: JSON.parse(JSON.stringify(currentState.document)),
        timestamp: Date.now(),
      })
    }

    // Restore next state
    const snapshot = this.redoStack.pop()!
    this.isRedoing = true
    canvasActions.setDocument(snapshot.document)
    this.isRedoing = false

    return true
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * Clear undo/redo history
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

}

interface DocumentSnapshot {
  document: Document
  timestamp: number
}

// Singleton instance
let undoRedoManagerInstance: UndoRedoManager | null = null

export function getUndoRedoManager(): UndoRedoManager {
  if (!undoRedoManagerInstance) {
    undoRedoManagerInstance = new UndoRedoManager()
  }
  return undoRedoManagerInstance
}
