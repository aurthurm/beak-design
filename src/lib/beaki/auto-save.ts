import { canvasStore, canvasActions } from '@/lib/canvas/store'
import { serializeBeaki } from './file-handler'
import { updateProjectLastEdited } from '@/lib/db/metadata'

const AUTO_SAVE_DELAY_MS = 5000 // 5 seconds
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null
let lastDocumentId: string | null = null
let lastDocumentUpdatedAt: string | null = null

/**
 * Auto-save document to .beaki file
 * Only saves if document has changed and there's a current file path
 */
async function performAutoSave(): Promise<void> {
  const state = canvasStore.state
  
  if (!state.document || !state.currentFilePath) {
    return
  }

  // Check if document actually changed
  if (
    state.document.id === lastDocumentId &&
    state.document.updatedAt === lastDocumentUpdatedAt
  ) {
    return
  }

  try {
    canvasActions.setSaveStatus('saving')
    
    const content = serializeBeaki(
      state.document,
      { panX: state.panX, panY: state.panY, zoom: state.zoom },
      state.selection
    )
    
    // Save to localStorage as backup (since we can't directly write to file system in browser)
    // The actual file download happens on manual save
    localStorage.setItem(`beaki_autosave_${state.document.id}`, content)
    localStorage.setItem(`beaki_autosave_path_${state.document.id}`, state.currentFilePath)
    
    lastDocumentId = state.document.id
    lastDocumentUpdatedAt = state.document.updatedAt
    
    // Update project history
    if (state.currentFilePath) {
      updateProjectLastEdited(state.currentFilePath)
    }
    
    canvasActions.setSaveStatus('saved')
    
    // Clear status after 2 seconds
    setTimeout(() => {
      const currentState = canvasStore.state
      if (currentState.saveStatus === 'saved' && currentState.document?.id === lastDocumentId) {
        canvasActions.setSaveStatus(null)
      }
    }, 2000)
  } catch (error) {
    console.error('Auto-save failed:', error)
    canvasActions.setSaveStatus('error')
    
    // Clear error status after 3 seconds
    setTimeout(() => {
      const currentState = canvasStore.state
      if (currentState.saveStatus === 'error' && currentState.document?.id === lastDocumentId) {
        canvasActions.setSaveStatus('unsaved')
      }
    }, 3000)
  }
}

/**
 * Schedule auto-save (debounced)
 */
function scheduleAutoSave(): void {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout)
  }

  const state = canvasStore.state
  
  // Only schedule if we have a document and a file path
  if (!state.document || !state.currentFilePath) {
    return
  }

  // Mark as unsaved immediately
  canvasActions.markDocumentDirty()

  autoSaveTimeout = setTimeout(() => {
    performAutoSave()
    autoSaveTimeout = null
  }, AUTO_SAVE_DELAY_MS)
}

/**
 * Setup auto-save subscription
 * Watches for document changes and schedules auto-save
 */
export function setupBeakiAutoSave(): () => void {
  let previousDocumentId: string | null = null
  let previousUpdatedAt: string | null = null

  const unsubscribe = canvasStore.subscribe((state) => {
    // Check if document changed
    const documentChanged =
      state.document &&
      (state.document.id !== previousDocumentId ||
        state.document.updatedAt !== previousUpdatedAt)

    if (documentChanged && state.document) {
      previousDocumentId = state.document.id
      previousUpdatedAt = state.document.updatedAt
      
      // Only auto-save if we have a file path (meaning it was saved before)
      if (state.currentFilePath) {
        scheduleAutoSave()
      }
    }
  })

  return () => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout)
      autoSaveTimeout = null
    }
    unsubscribe()
  }
}

/**
 * Manually trigger auto-save (useful for explicit save)
 */
export async function triggerAutoSave(): Promise<void> {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout)
    autoSaveTimeout = null
  }
  await performAutoSave()
}
