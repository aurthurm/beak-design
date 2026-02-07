import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
} from '@/components/ui/menubar'
import { useStore } from '@tanstack/react-store'
import { canvasStore, canvasActions } from '@/lib/canvas/store'
import { createEmptyDocument } from '@/lib/canvas/document-init'
import { serializeBeaki, downloadBeakiFile, openBeakiFile, saveBeakiFileToWorkspace } from '@/lib/beaki'
import { getCurrentWorkspaceHandle } from '@/lib/db/metadata'
import { setupBeakiAutoSave } from '@/lib/beaki/auto-save'
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { triggerAutoSave } from '@/lib/beaki/auto-save'
import {
  Dialog,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TemplatePicker } from '@/components/templates/TemplatePicker'
import { AISettingsDialog } from '@/components/settings/AISettingsDialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getCurrentWorkspace,
  setCurrentWorkspace,
  addProjectToHistory,
  updateProjectLastEdited,
  initMetadataDb,
} from '@/lib/db/metadata'
import { requestWorkspaceFolder, isFileSystemAccessSupported } from '@/lib/utils/file-system-access'
import { createRootFilePath } from '@/lib/utils/path'

export function AppMenubar() {
  const canvasState = useStore(canvasStore)
  const saveStatus = useStore(canvasStore, (state) => state.saveStatus)
  const [isEditingFileName, setIsEditingFileName] = useState(false)
  const [fileNameValue, setFileNameValue] = useState('')
  const [inputWidth, setInputWidth] = useState(100)
  const [showFileLocation, setShowFileLocation] = useState(false)
  const [currentWorkspace, setCurrentWorkspaceState] = useState<string | null>(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const isOpeningFileRef = useRef(false)

  // Load current workspace on mount and subscribe to changes
  useEffect(() => {
    const loadWorkspace = async () => {
      await initMetadataDb()
      const workspace = getCurrentWorkspace()
      setCurrentWorkspaceState(workspace)
    }
    loadWorkspace()
    
    // Also check workspace periodically in case it changes elsewhere
    const interval = setInterval(() => {
      const workspace = getCurrentWorkspace()
      setCurrentWorkspaceState(prev => {
        if (prev !== workspace) {
          return workspace
        }
        return prev
      })
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Setup auto-save and show location when saved
  useEffect(() => {
    let previousSaveStatus: typeof saveStatus = null
    
    const unsubscribe = canvasStore.subscribe((state) => {
      // Show location briefly when save status changes to 'saved'
      if (state.saveStatus === 'saved' && previousSaveStatus !== 'saved' && state.currentFilePath) {
        setShowFileLocation(true)
        setTimeout(() => {
          setShowFileLocation(false)
        }, 2000)
      }
      previousSaveStatus = state.saveStatus
    })
    
    const autoSaveUnsubscribe = setupBeakiAutoSave()
    
    return () => {
      unsubscribe()
      autoSaveUnsubscribe()
    }
  }, [])

  // Extract filename from path or use document name
  const getDisplayFileName = useCallback((): string => {
    if (canvasState.currentFilePath) {
      const separator = canvasState.currentFilePath.includes('\\') ? '\\' : '/'
      const filename = canvasState.currentFilePath.split(separator).pop() || ''
      // Remove .beaki extension for display
      return filename.replace(/\.beaki$/, '')
    }
    return canvasState.document?.name || 'Untitled'
  }, [canvasState.currentFilePath, canvasState.document?.name])

  // Extract directory path from file path
  const getFileLocation = useCallback((): string => {
    if (!canvasState.currentFilePath) return ''
    const separator = canvasState.currentFilePath.includes('\\') ? '\\' : '/'
    const parts = canvasState.currentFilePath.split(separator)
    parts.pop() // Remove filename
    return parts.join(separator) || ''
  }, [canvasState.currentFilePath])

  // Show file location briefly when saving
  const showLocationBriefly = useCallback(() => {
    if (!canvasState.currentFilePath) return
    setShowFileLocation(true)
    setTimeout(() => {
      setShowFileLocation(false)
    }, 2000) // Show for 2 seconds
  }, [canvasState.currentFilePath])

  // Update fileNameValue when document changes
  useEffect(() => {
    if (!isEditingFileName) {
      setFileNameValue(getDisplayFileName())
    }
  }, [getDisplayFileName, isEditingFileName])

  // Update input width based on content
  useEffect(() => {
    if (isEditingFileName && measureRef.current) {
      const width = Math.max(100, Math.min(measureRef.current.offsetWidth + 20, 400))
      setInputWidth(width)
    }
  }, [fileNameValue, isEditingFileName])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingFileName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingFileName])

  const handleFileNameClick = () => {
    if (canvasState.document) {
      setFileNameValue(getDisplayFileName())
      setIsEditingFileName(true)
    }
  }

  const handleFileNameBlur = () => {
    handleFileNameSave()
  }

  const handleFileNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleFileNameSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsEditingFileName(false)
      setFileNameValue(getDisplayFileName())
    }
  }

  const handleFileNameSave = async () => {
    if (!canvasState.document) return

    const trimmedValue = fileNameValue.trim()
    if (trimmedValue && trimmedValue !== getDisplayFileName()) {
      // Get current workspace to pass to updateDocumentName
      const workspace = getCurrentWorkspace()
      const workspaceHandle = await getCurrentWorkspaceHandle()
      const oldFilePath = canvasState.currentFilePath
      
      console.log('[File Name Change] Starting name change (rename operation):')
      console.log('  - Old name:', getDisplayFileName())
      console.log('  - New name:', trimmedValue)
      console.log('  - Current file path:', oldFilePath)
      console.log('  - Workspace path:', workspace)
      
      // Update document name (will also update file path using workspace)
      canvasActions.updateDocumentName(trimmedValue, workspace)
      
      // Get the new file path after update
      const newFilePath = canvasStore.state.currentFilePath
      console.log('  - New file path after update:', newFilePath)
      
      // If no file was open initially (no old path), this is a new file - just save it
      if (!oldFilePath) {
        console.log('  - No existing file: This is a new file, saving to new path')
        // Save the file normally using handleSave logic
        await handleSave()
        setIsEditingFileName(false)
        return
      }

      // If old and new paths are the same, nothing to do
      if (oldFilePath === newFilePath) {
        console.log('  - File path unchanged, no rename needed')
        setIsEditingFileName(false)
        return
      }

      try {
        canvasActions.setSaveStatus('saving')
        
        const { isTauri, writeFile, fileExists, renameFile, getDefaultSaveDirectory } = await import('@/lib/utils/tauri-fs')
        const isTauriEnv = isTauri()
        
        if (isTauriEnv && oldFilePath && (oldFilePath.includes('/') || oldFilePath.includes('\\'))) {
          // Check if old file exists
          const oldFileExists = await fileExists(oldFilePath)
          console.log('  - Old file exists:', oldFileExists)
          
          if (oldFileExists && newFilePath && (newFilePath.includes('/') || newFilePath.includes('\\'))) {
            // Rename the existing file
            console.log('  - Rename method: Renaming existing file')
            console.log('  - From:', oldFilePath)
            console.log('  - To:', newFilePath)
            
            try {
              await renameFile(oldFilePath, newFilePath)
              console.log('  - ✓ File renamed successfully')
              
              // Update the content to ensure it's saved with new name
              const content = serializeBeaki(
                canvasStore.state.document!,
                { panX: canvasStore.state.panX, panY: canvasStore.state.panY, zoom: canvasStore.state.zoom },
                canvasStore.state.selection
              )
              await writeFile(newFilePath, content)
              console.log('  - ✓ File content updated')
              
              canvasActions.setSaveStatus('saved')
            } catch (renameError) {
              console.error('  - ⚠️  Rename failed, falling back to save-as-new:', renameError)
              // If rename fails, save to new path and old file will remain
              const content = serializeBeaki(
                canvasStore.state.document!,
                { panX: canvasStore.state.panX, panY: canvasStore.state.panY, zoom: canvasStore.state.zoom },
                canvasStore.state.selection
              )
              await writeFile(newFilePath, content)
              console.log('  - ✓ File saved to new path (old file may still exist)')
              canvasActions.setSaveStatus('saved')
            }
          } else {
            // Old file doesn't exist or new path is not a full path - just save to new location
            console.log('  - Save method: Save to new path (old file does not exist or invalid path)')
            const content = serializeBeaki(
              canvasStore.state.document!,
              { panX: canvasStore.state.panX, panY: canvasStore.state.panY, zoom: canvasStore.state.zoom },
              canvasStore.state.selection
            )
            
            if (newFilePath && (newFilePath.includes('/') || newFilePath.includes('\\'))) {
              await writeFile(newFilePath, content)
              console.log('  - ✓ File saved to:', newFilePath)
              canvasActions.setSaveStatus('saved')
            } else if (workspaceHandle) {
              await saveBeakiFileToWorkspace(workspaceHandle, content, newFilePath || `${trimmedValue}.beaki`)
              if (typeof workspaceHandle === 'string') {
                const pathSeparator = workspaceHandle.includes('\\') ? '\\' : '/'
                const filename = (newFilePath || `${trimmedValue}.beaki`).includes(pathSeparator) 
                  ? (newFilePath || `${trimmedValue}.beaki`).split(pathSeparator).pop() || `${trimmedValue}.beaki`
                  : (newFilePath || `${trimmedValue}.beaki`)
                const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
                const fullPath = workspaceHandle.endsWith(pathSeparator)
                  ? `${workspaceHandle}${finalFilename}`
                  : `${workspaceHandle}${pathSeparator}${finalFilename}`
                canvasActions.setCurrentFilePath(fullPath)
                console.log('  - ✓ File saved to workspace:', fullPath)
              }
              canvasActions.setSaveStatus('saved')
            } else {
              const defaultDir = await getDefaultSaveDirectory()
              if (defaultDir) {
                const pathSeparator = defaultDir.includes('\\') ? '\\' : '/'
                const finalFilename = `${trimmedValue}.beaki`
                const fullPath = defaultDir.endsWith(pathSeparator)
                  ? `${defaultDir}${finalFilename}`
                  : `${defaultDir}${pathSeparator}${finalFilename}`
                await writeFile(fullPath, content)
                canvasActions.setCurrentFilePath(fullPath)
                console.log('  - ✓ File saved to default directory:', fullPath)
                canvasActions.setSaveStatus('saved')
              } else {
                await triggerAutoSave()
                canvasActions.setSaveStatus('saved')
              }
            }
          }
        } else {
          // Browser mode or invalid paths - just update localStorage
          console.log('  - Save method: Browser localStorage (auto-save)')
          await triggerAutoSave()
          canvasActions.setSaveStatus('saved')
        }
        
        // Update project history
        const finalFilePath = canvasStore.state.currentFilePath
        console.log('  - Final file path after rename:', finalFilePath)
        if (finalFilePath) {
          await updateProjectLastEdited(finalFilePath)
        }
        
        showLocationBriefly()
        
        // Clear saved status after 2 seconds
        setTimeout(() => {
          canvasActions.setSaveStatus(null)
        }, 2000)
      } catch (error) {
        console.error('[File Name Change] Rename/save failed:', error)
        console.error('  - Error details:', error instanceof Error ? error.message : String(error))
        // Fallback to auto-save if rename fails
        await triggerAutoSave()
        canvasActions.setSaveStatus('saved')
        
        setTimeout(() => {
          canvasActions.setSaveStatus(null)
        }, 2000)
      }
    } else {
      // Reset to original if empty or unchanged
      setFileNameValue(getDisplayFileName())
    }
    setIsEditingFileName(false)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // Toggle devtools with F12 or Ctrl+Shift+I (Cmd+Option+I on Mac)
      if (e.key === 'F12' || (cmdOrCtrl && e.shiftKey && e.key === 'I')) {
        e.preventDefault()
        handleToggleDevtools()
        return
      }

      if (cmdOrCtrl && e.key === 'n' && !e.shiftKey) {
        e.preventDefault()
        handleNew()
      } else if (cmdOrCtrl && e.key === 'o' && !e.shiftKey) {
        e.preventDefault()
        handleOpen()
      } else if (cmdOrCtrl && e.key === 's') {
        e.preventDefault()
        if (e.shiftKey) {
          handleSaveAs()
        } else {
          handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canvasState.document, canvasState.currentFilePath])

  // Silent save function - saves without showing any UI feedback
  const silentSave = async (): Promise<void> => {
    if (!canvasState.document || canvasState.saveStatus !== 'unsaved') {
      return
    }
    
    console.log('[Silent-Save] Saving unsaved changes silently')
    
    const { isTauri, writeFile } = await import('@/lib/utils/tauri-fs')
    const workspace = getCurrentWorkspace()
    const workspaceHandle = await getCurrentWorkspaceHandle()
    let filePath = canvasState.currentFilePath
    
    // If no file path but workspace is set, create file path from workspace
    if (!filePath) {
      if (workspace && workspaceHandle) {
        const pathSeparator = workspace.includes('\\') ? '\\' : '/'
        const filename = canvasState.document.name || 'Untitled'
        const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
        filePath = workspace.endsWith(pathSeparator)
          ? `${workspace}${finalFilename}`
          : `${workspace}${pathSeparator}${finalFilename}`
        canvasActions.setCurrentFilePath(filePath)
      } else {
        // No workspace: try default directory or skip
        const { getDefaultSaveDirectory } = await import('@/lib/utils/tauri-fs')
        if (isTauri()) {
          const defaultDir = await getDefaultSaveDirectory()
          if (defaultDir) {
            const pathSeparator = defaultDir.includes('\\') ? '\\' : '/'
            const filename = canvasState.document.name || 'Untitled'
            const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
            filePath = defaultDir.endsWith(pathSeparator)
              ? `${defaultDir}${finalFilename}`
              : `${defaultDir}${pathSeparator}${finalFilename}`
            canvasActions.setCurrentFilePath(filePath)
          }
        }
      }
    }
    
    if (!filePath) {
      console.log('[Silent-Save] No file path available, skipping save')
      return
    }
    
    try {
      const content = serializeBeaki(
        canvasState.document,
        { panX: canvasState.panX, panY: canvasState.panY, zoom: canvasState.zoom },
        canvasState.selection
      )
      
      const isFullPath = isTauri() && (filePath.includes('/') || filePath.includes('\\'))
      
      if (isFullPath) {
        // Tauri: save directly to file path
        await writeFile(filePath, content)
        // Update status silently (don't show UI)
        canvasStore.setState((state) => ({ ...state, saveStatus: 'saved' }))
        await updateProjectLastEdited(filePath)
        console.log('[Silent-Save] File saved successfully')
      } else if (workspaceHandle) {
        // Save to workspace
        await saveBeakiFileToWorkspace(workspaceHandle, content, filePath)
        if (typeof workspaceHandle === 'string') {
          const pathSeparator = workspaceHandle.includes('\\') ? '\\' : '/'
          const filename = filePath.includes(pathSeparator) 
            ? filePath.split(pathSeparator).pop() || filePath
            : filePath
          const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
          const fullPath = workspaceHandle.endsWith(pathSeparator)
            ? `${workspaceHandle}${finalFilename}`
            : `${workspaceHandle}${pathSeparator}${finalFilename}`
          canvasActions.setCurrentFilePath(fullPath)
          await updateProjectLastEdited(fullPath)
        }
        canvasStore.setState((state) => ({ ...state, saveStatus: 'saved' }))
        console.log('[Silent-Save] File saved to workspace')
      } else {
        // Fallback: auto-save to localStorage
        await triggerAutoSave()
        canvasStore.setState((state) => ({ ...state, saveStatus: 'saved' }))
        console.log('[Silent-Save] Saved to localStorage')
      }
    } catch (error) {
      console.error('[Silent-Save] Save failed:', error)
      // Don't throw - continue anyway
    }
  }
  
  // Helper function to save unsaved changes and wait for completion
  const saveUnsavedChanges = async (): Promise<void> => {
    if (!canvasState.document || canvasState.saveStatus !== 'unsaved') {
      return
    }
    
    // Use silent save - no UI feedback
    await silentSave()
  }

  const handleNew = async () => {
    // Save unsaved changes first if any
    await saveUnsavedChanges()
    
    const newDoc = createEmptyDocument('Untitled')
    canvasActions.setDocument(newDoc)
    canvasActions.setActivePage(newDoc.activePageId)
    canvasActions.setCurrentFilePath(null)
    canvasActions.setSaveStatus(null)
  }

  const handleOpen = async () => {
    // Prevent multiple simultaneous open operations
    if (isOpeningFileRef.current) {
      console.log('[Open] Already opening a file, ignoring duplicate request')
      return
    }
    
    try {
      isOpeningFileRef.current = true
      
      // Save unsaved changes first if any
      await saveUnsavedChanges()
      
      // Small delay to ensure all async operations complete and UI is ready
      // This prevents dialog from being blocked or inactive
      await new Promise(resolve => setTimeout(resolve, 100))

      const result = await openBeakiFile()
      if (!result) return

      const { project, filePath: openedFilePath } = result

      canvasActions.setDocument(project.document)
      canvasActions.setActivePage(project.document.activePageId)
      
      // Restore viewport if available
      if (project.viewport) {
        canvasActions.setViewport(project.viewport.panX, project.viewport.panY, project.viewport.zoom)
      }

      // Restore selection if available
      if (project.selection) {
        canvasActions.setSelection(project.selection)
      }

      // Use the actual file path from Tauri or browser
      // If it's a Tauri path (full path), use it directly
      // Otherwise, construct path based on workspace
      const { isTauri } = await import('@/lib/utils/tauri-fs')
      let filePath = openedFilePath
      
      if (!isTauri() || !openedFilePath.includes('/') && !openedFilePath.includes('\\')) {
        // Browser mode or just filename: use workspace if available
        const workspace = getCurrentWorkspace()
        if (workspace) {
          const pathSeparator = workspace.includes('\\') ? '\\' : '/'
          filePath = workspace.endsWith(pathSeparator)
            ? `${workspace}${openedFilePath}`
            : `${workspace}${pathSeparator}${openedFilePath}`
        }
      }
      
      canvasActions.setCurrentFilePath(filePath)
      canvasActions.setSaveStatus(null)
      
      // Add to project history
      await addProjectToHistory(filePath, project.document.name, getCurrentWorkspace() || '')
    } finally {
      isOpeningFileRef.current = false
    }
    setTimeout(() => {
      canvasActions.setSaveStatus(null)
    }, 2000)
  }

  const handleSetWorkspace = async (): Promise<string | null> => {
    try {
      const result = await requestWorkspaceFolder()
      if (result) {
        const { handle, displayPath } = result
        await setCurrentWorkspace(displayPath, handle)
        setCurrentWorkspaceState(displayPath) // Update local state
        
        if (handle) {
          alert(`Workspace set to: ${displayPath}\n\nFiles will be saved directly to this folder.`)
        } else {
          alert(`Workspace set to: ${displayPath}\n\nNote: File System Access API not available. Files will be saved to Downloads folder.`)
        }
        return displayPath
      }
      return null
    } catch (error) {
      console.error('Failed to set workspace:', error)
      alert('Failed to set workspace. Please try again.')
      return null
    }
  }

  const handleToggleDevtools = async () => {
    const { isTauri } = await import('@/lib/utils/tauri-fs')
    if (isTauri()) {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
        const window = getCurrentWebviewWindow()
        await window.toggleDevtools()
      } catch (error) {
        console.error('Failed to toggle devtools:', error)
        // Try alternative API
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          const window = getCurrentWindow()
          await window.toggleDevtools()
        } catch (error2) {
          console.error('Failed with alternative API:', error2)
          alert('Failed to toggle developer tools. Make sure you are running in development mode.')
        }
      }
    } else {
      alert('Developer tools are only available in Tauri desktop app.')
    }
  }
  
  // Get folder name from workspace path
  const getWorkspaceFolderName = (): string => {
    if (!currentWorkspace) return 'Not set'
    const separator = currentWorkspace.includes('\\') ? '\\' : '/'
    const parts = currentWorkspace.split(separator)
    return parts[parts.length - 1] || currentWorkspace
  }

  const handleSave = async () => {
    if (!canvasState.document) {
      alert('No document to save')
      return
    }

    canvasActions.setSaveStatus('saving')

    const { isTauri, writeFile } = await import('@/lib/utils/tauri-fs')
    
    // Check workspace and update file path
    const workspace = getCurrentWorkspace()
    const workspaceHandle = await getCurrentWorkspaceHandle()
    let filePath = canvasState.currentFilePath
    
    console.log('[Save] Starting save operation:')
    console.log('  - Document name:', canvasState.document.name)
    console.log('  - Current file path:', filePath)
    console.log('  - Workspace path:', workspace)
    console.log('  - Workspace handle:', workspaceHandle ? (typeof workspaceHandle === 'string' ? workspaceHandle : 'FileSystemDirectoryHandle') : 'null')
    
    // If no file path but workspace is set, create file path from workspace
    if (!filePath) {
      if (workspace && workspaceHandle) {
        // Create file path from workspace
        const pathSeparator = workspace.includes('\\') ? '\\' : '/'
        const filename = canvasState.document.name || 'Untitled'
        const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
        filePath = workspace.endsWith(pathSeparator)
          ? `${workspace}${finalFilename}`
          : `${workspace}${pathSeparator}${finalFilename}`
        console.log('  - No file path but workspace exists: creating path from workspace')
        console.log('  - Created file path:', filePath)
        canvasActions.setCurrentFilePath(filePath)
      } else {
        // No workspace either: use Save As flow
        console.log('  - No file path and no workspace: redirecting to Save As')
        await handleSaveAs()
        return
      }
    }

    try {
      const content = serializeBeaki(
        canvasState.document,
        { panX: canvasState.panX, panY: canvasState.panY, zoom: canvasState.zoom },
        canvasState.selection
      )

      // Check if filePath is a full Tauri path
      const isFullPath = isTauri() && (filePath.includes('/') || filePath.includes('\\'))
      
      console.log('  - Is full path:', isFullPath)
      console.log('  - Is Tauri:', isTauri())
      
      if (isFullPath) {
        // Tauri: save directly to file path
        console.log('  - Save method: Direct path write')
        console.log('  - Saving to:', filePath)
        await writeFile(filePath, content)
        console.log('  - ✓ File saved successfully to:', filePath)
        canvasActions.setSaveStatus('saved')
      } else {
        // Try to save to workspace
        const workspaceHandle = await getCurrentWorkspaceHandle()
        console.log('  - Workspace handle:', workspaceHandle ? (typeof workspaceHandle === 'string' ? workspaceHandle : 'FileSystemDirectoryHandle') : 'null')
        
        if (workspaceHandle) {
          // Save directly to workspace folder
          console.log('  - Save method: Workspace folder')
          await saveBeakiFileToWorkspace(workspaceHandle, content, filePath)
          
          // Update filePath to full path if workspace is a string (Tauri)
          if (typeof workspaceHandle === 'string') {
            const pathSeparator = workspaceHandle.includes('\\') ? '\\' : '/'
            const filename = filePath.includes(pathSeparator) 
              ? filePath.split(pathSeparator).pop() || filePath
              : filePath
            const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
            const fullPath = workspaceHandle.endsWith(pathSeparator)
              ? `${workspaceHandle}${finalFilename}`
              : `${workspaceHandle}${pathSeparator}${finalFilename}`
            console.log('  - Workspace folder:', workspaceHandle)
            console.log('  - Filename:', finalFilename)
            console.log('  - ✓ File saved successfully to:', fullPath)
            canvasActions.setCurrentFilePath(fullPath)
          } else {
            console.log('  - ✓ File saved to workspace (FileSystemDirectoryHandle)')
          }
          
          canvasActions.setSaveStatus('saved')
        } else {
          // Check if Tauri is available
          const { isTauri: checkTauri, getDefaultSaveDirectory } = await import('@/lib/utils/tauri-fs')
          
          if (checkTauri()) {
            // No workspace set: save to Documents/Beak Designs
            console.log('  - Save method: Documents/Beak Designs (default)')
            const defaultDir = await getDefaultSaveDirectory()
            console.log('  - Default directory:', defaultDir)
            
            if (defaultDir) {
              const pathSeparator = defaultDir.includes('\\') ? '\\' : '/'
              const filename = filePath.includes(pathSeparator) 
                ? filePath.split(pathSeparator).pop() || filePath
                : filePath
              const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
              const fullPath = defaultDir.endsWith(pathSeparator)
                ? `${defaultDir}${finalFilename}`
                : `${defaultDir}${pathSeparator}${finalFilename}`
              
              console.log('  - Filename:', finalFilename)
              console.log('  - ✓ File saved successfully to:', fullPath)
              await writeFile(fullPath, content)
              canvasActions.setCurrentFilePath(fullPath)
              canvasActions.setSaveStatus('saved')
            } else {
              console.log('  - ✗ Default directory not found, falling back to localStorage')
              // Fallback: save to localStorage (auto-save)
              await triggerAutoSave()
              canvasActions.setSaveStatus('saved')
            }
          } else {
            console.log('  - Save method: Browser localStorage (auto-save)')
            // Browser: fallback to localStorage (auto-save)
            await triggerAutoSave()
            canvasActions.setSaveStatus('saved')
          }
        }
      }
      
      // Update project history
      const finalFilePath = canvasStore.state.currentFilePath
      console.log('  - Final file path after save:', finalFilePath)
      if (finalFilePath) {
        await updateProjectLastEdited(finalFilePath)
      }
      
      showLocationBriefly()
      
      // Clear saved status after a delay, but not if we're in auto-save mode
      // The saveUnsavedChanges function will handle clearing it
      setTimeout(() => {
        // Only clear if still in saved state (not already changed by another action)
        if (canvasStore.state.saveStatus === 'saved') {
          canvasActions.setSaveStatus(null)
        }
      }, 1500)
    } catch (error) {
      console.error('[Save] Save failed:', error)
      console.error('  - Error details:', error instanceof Error ? error.message : String(error))
      // Fallback to auto-save if workspace save fails
      await triggerAutoSave()
      canvasActions.setSaveStatus('saved')
      
      setTimeout(() => {
        canvasActions.setSaveStatus(null)
      }, 2000)
    }
  }

  const handleSaveAs = async () => {
    if (!canvasState.document) {
      alert('No document to save')
      return
    }

    canvasActions.setSaveStatus('saving')

    const { isTauri, requestSaveLocation, writeFile } = await import('@/lib/utils/tauri-fs')

    try {
      const filename = canvasState.document.name || 'untitled'
      const suggestedName = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
      const content = serializeBeaki(
        canvasState.document,
        { panX: canvasState.panX, panY: canvasState.panY, zoom: canvasState.zoom },
        canvasState.selection
      )

      if (isTauri()) {
        // Tauri: use save dialog
        const savePath = await requestSaveLocation(suggestedName)
        if (!savePath) {
          // User cancelled
          canvasActions.setSaveStatus(null)
          return
        }

        if (typeof savePath === 'string') {
          // Tauri path
          await writeFile(savePath, content)
          canvasActions.setCurrentFilePath(savePath)
          
          // Add to project history
          const workspace = getCurrentWorkspace()
          await addProjectToHistory(savePath, canvasState.document.name, workspace || '')
        }
      } else {
        // Browser: use download
        downloadBeakiFile(content, suggestedName)
        
        // For browser, we can't get the actual save path, so use filename
        canvasActions.setCurrentFilePath(suggestedName)
      }
      
      canvasActions.setSaveStatus('saved')
      
      // Clear saved status after 2 seconds
      setTimeout(() => {
        canvasActions.setSaveStatus(null)
      }, 2000)
    } catch (error) {
      console.error('Save As failed:', error)
      canvasActions.setSaveStatus('error')
      setTimeout(() => {
        canvasActions.setSaveStatus('unsaved')
      }, 3000)
    }
  }

  return (
    <Menubar className="rounded-none border-b border-x-0 border-t-0 h-8 flex items-center justify-between">
      <div className="flex items-center">
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>New</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={handleNew}>
                Blank Canvas
              </MenubarItem>
              <MenubarSeparator />
              <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
                <DialogTrigger asChild>
                  <MenubarItem onSelect={(e) => {
                    e.preventDefault()
                    setTemplatePickerOpen(true)
                  }}>
                    From Template...
                  </MenubarItem>
                </DialogTrigger>
                <TemplatePicker
                  onSelect={(templateId) => {
                    console.log('Template selected:', templateId)
                    setTemplatePickerOpen(false)
                  }}
                  onClose={() => setTemplatePickerOpen(false)}
                />
              </Dialog>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarItem onClick={handleOpen}>
            Open <MenubarShortcut>⌘O</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleSave}>
            Save <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleSaveAs}>
            Save As... <MenubarShortcut>⇧⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={handleSetWorkspace}>
            <div className="flex flex-col items-start w-full">
              <span>Set Workspace...</span>
              {currentWorkspace ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground mt-0.5 cursor-help">
                        Current: {getWorkspaceFolderName()}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono text-xs max-w-md break-all">{currentWorkspace}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="text-xs text-muted-foreground mt-0.5">Current: Not set</span>
              )}
            </div>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Export...
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Exit
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Undo <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Cut <MenubarShortcut>⌘X</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Copy <MenubarShortcut>⌘C</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Paste <MenubarShortcut>⌘V</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Select All <MenubarShortcut>⌘A</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Zoom In <MenubarShortcut>⌘+</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Zoom Out <MenubarShortcut>⌘-</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Reset Zoom <MenubarShortcut>⌘0</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Show Grid
          </MenubarItem>
          <MenubarItem>
            Show Rulers
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={handleToggleDevtools}>
            Toggle Developer Tools <MenubarShortcut>F12</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Fullscreen <MenubarShortcut>⌃⌘F</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Window</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Minimize <MenubarShortcut>⌘M</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Close Window <MenubarShortcut>⌘W</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Show Pages Panel
          </MenubarItem>
          <MenubarItem>
            Show Inspector Panel
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            New Window
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Settings</MenubarTrigger>
        <MenubarContent>
          <Dialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen}>
            <DialogTrigger asChild>
              <MenubarItem onSelect={(e) => {
                e.preventDefault()
                setAiSettingsOpen(true)
              }}>
                AI Assistant...
              </MenubarItem>
            </DialogTrigger>
            <AISettingsDialog
              open={aiSettingsOpen}
              onOpenChange={setAiSettingsOpen}
            />
          </Dialog>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Documentation
          </MenubarItem>
          <MenubarItem>
            Keyboard Shortcuts
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            About Beak Design
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 gap-2">
        {showFileLocation && (
          <span
            className="text-xs text-muted-foreground font-mono"
            style={{
              animation: 'fadeInSlide 0.3s ease-out, fadeOutSlide 0.3s ease-in 1.7s forwards',
            }}
          >
            {getFileLocation()}
          </span>
        )}
        {isEditingFileName ? (
          <div className="relative inline-flex items-center">
            <span
              ref={measureRef}
              className="invisible absolute whitespace-pre text-sm px-2"
              aria-hidden="true"
            >
              {fileNameValue || ' '}
            </span>
            <Input
              ref={inputRef}
              value={fileNameValue}
              onChange={(e) => setFileNameValue(e.target.value)}
              onBlur={handleFileNameBlur}
              onKeyDown={handleFileNameKeyDown}
              className="h-6 px-2 text-sm text-center bg-background border border-border rounded"
              style={{ width: `${inputWidth}px`, minWidth: '100px', maxWidth: '400px' }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <button
            onClick={handleFileNameClick}
            className="px-3 py-1 text-sm font-medium text-foreground hover:bg-accent rounded transition-colors cursor-pointer"
            title="Click to edit file name"
          >
            {getDisplayFileName()}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 px-4">
        {saveStatus === 'unsaved' && (
          <Button
            onClick={handleSave}
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs gap-1.5"
          >
            <Save className="size-3" />
            Save
          </Button>
        )}
        {canvasState.document && (
          <SaveStatusIndicator 
            status={saveStatus} 
            showText={true}
            className={saveStatus === 'saving' ? 'px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 shadow-sm' : ''}
          />
        )}
      </div>
    </Menubar>
  )
}
