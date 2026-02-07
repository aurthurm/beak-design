/**
 * Tauri File System API wrapper
 * Provides native file system access when running in Tauri, falls back to browser APIs otherwise
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Request workspace folder from user using Tauri dialog
 * Returns the selected directory path (Tauri) or FileSystemDirectoryHandle (browser)
 */
export async function requestWorkspaceFolder(): Promise<{
  handle: string | FileSystemDirectoryHandle | null
  displayPath: string
} | null> {
  if (isTauri()) {
    try {
      // Use JavaScript dialog API directly - more reliable than Rust callbacks
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: true,
        multiple: false,
      })
      
      if (!selected) {
        return null
      }
      
      // Handle single directory or array
      const path = Array.isArray(selected) ? selected[0] : selected
      
      if (typeof path === 'string') {
        return {
          handle: path,
          displayPath: path,
        }
      }
      
      return null
    } catch (error) {
      console.error('Error selecting workspace folder:', error)
      // Fallback to Rust command
      try {
        const path = await invoke<string | null>('open_directory_dialog')
        if (!path) {
          return null
        }
        return {
          handle: path,
          displayPath: path,
        }
      } catch (fallbackError) {
        console.error('Fallback dialog also failed:', fallbackError)
        return null
      }
    }
  }

  // Fallback to browser File System Access API
  if (typeof window === 'undefined') {
    return null
  }

  if ('showDirectoryPicker' in window) {
    try {
      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      })

      const folderName = directoryHandle.name
      const platform = navigator.platform.toLowerCase()
      const separator = platform.includes('win') ? '\\' : '/'
      const displayPath = platform.includes('win')
        ? `C:${separator}Users${separator}User${separator}Documents${separator}${folderName}`
        : platform.includes('mac')
        ? `${separator}Users${separator}user${separator}Documents${separator}${folderName}`
        : `${separator}home${separator}user${separator}Documents${separator}${folderName}`

      return {
        handle: directoryHandle,
        displayPath,
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null
      }
      console.error('Error selecting workspace folder:', error)
      return null
    }
  }

  // Final fallback: prompt for path
  const fullPath = prompt(
    'File System Access API not supported in this browser.\n\n' +
      'Enter workspace folder path for reference:\n' +
      '(e.g., /home/user/Documents/Beak Designs)\n\n' +
      'Note: Files will still be saved to Downloads folder.'
  )

  if (!fullPath?.trim()) {
    return null
  }

  return {
    handle: null,
    displayPath: fullPath.trim(),
  }
}

/**
 * Request file save location using Tauri dialog
 */
export async function requestSaveLocation(
  suggestedName: string
): Promise<string | FileSystemFileHandle | null> {
  if (isTauri()) {
    try {
      // Use JavaScript dialog API directly - more reliable than Rust callbacks
      const { save } = await import('@tauri-apps/plugin-dialog')
      const selected = await save({
        defaultPath: suggestedName,
        filters: [
          {
            name: 'Beaki Design Files',
            extensions: ['beaki', 'json'],
          },
        ],
      })
      
      return selected || null
    } catch (error) {
      console.error('Error selecting save location:', error)
      // Fallback to Rust command
      try {
        const path = await invoke<string | null>('save_file_dialog', {
          defaultPath: suggestedName,
        })
        return path
      } catch (fallbackError) {
        console.error('Fallback dialog also failed:', fallbackError)
        return null
      }
    }
  }

  // Fallback to browser File System Access API
  if (typeof window === 'undefined') {
    return null
  }

  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Beaki Design Files',
            accept: {
              'application/json': ['.beaki'],
            },
          },
        ],
      })
      return fileHandle
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null
      }
      console.error('Error selecting save location:', error)
      return null
    }
  }

  return null
}

/**
 * Open file picker and return file path (Tauri) or File object (browser)
 */
export async function openFilePicker(): Promise<string | File | null> {
  if (isTauri()) {
    try {
      // Ensure we're in the next event loop tick to avoid blocking issues
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Use JavaScript dialog API directly - more reliable than Rust callbacks
      const { open } = await import('@tauri-apps/plugin-dialog')
      
      // Ensure window is focused before opening dialog
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
        const window = getCurrentWebviewWindow()
        await window.setFocus()
      } catch (focusError) {
        // Ignore focus errors - dialog should still work
        console.log('Could not set focus:', focusError)
      }
      
      const selected = await open({
        multiple: false,
        directory: false, // Explicitly only allow files, not directories
        filters: [
          {
            name: 'Beaki Design Files',
            extensions: ['beaki', 'json'],
          },
        ],
      })
      
      if (!selected) {
        return null
      }
      
      // Handle single file or array
      if (Array.isArray(selected)) {
        return selected[0] || null
      }
      
      return selected
    } catch (error) {
      console.error('Error opening file picker:', error)
      // Fallback to Rust command
      try {
        const path = await invoke<string | null>('open_file_dialog')
        return path
      } catch (fallbackError) {
        console.error('Fallback dialog also failed:', fallbackError)
        return null
      }
    }
  }

  // Fallback to browser file input
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.beaki,application/json'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      resolve(file || null)
    }

    input.oncancel = () => {
      resolve(null)
    }

    input.click()
  })
}

/**
 * Read file content
 */
export async function readFile(
  pathOrFile: string | File
): Promise<string> {
  if (isTauri() && typeof pathOrFile === 'string') {
    try {
      return await invoke<string>('read_file', { path: pathOrFile })
    } catch (error) {
      console.error('Error reading file:', error)
      throw error
    }
  }

  // Browser File API
  if (pathOrFile instanceof File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        resolve(e.target?.result as string)
      }
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      reader.readAsText(pathOrFile)
    })
  }

  throw new Error('Invalid file reference')
}

/**
 * Write file content
 */
export async function writeFile(
  pathOrHandle: string | FileSystemFileHandle,
  content: string
): Promise<void> {
  if (isTauri() && typeof pathOrHandle === 'string') {
    try {
      await invoke('write_file', {
        path: pathOrHandle,
        contents: content,
      })
      return
    } catch (error) {
      console.error('Error writing file:', error)
      throw error
    }
  }

  // Browser File System Access API
  if (pathOrHandle && 'createWritable' in pathOrHandle) {
    const writable = await pathOrHandle.createWritable()
    await writable.write(content)
    await writable.close()
    return
  }

  throw new Error('Invalid file reference')
}

/**
 * Save file to workspace directory
 */
export async function saveFileToWorkspace(
  handle: string | FileSystemDirectoryHandle,
  filename: string,
  content: string
): Promise<void> {
  if (isTauri() && typeof handle === 'string') {
    // Extract just the filename from path if full path provided
    const pathSeparator = handle.includes('\\') ? '\\' : '/'
    let finalFilename = filename
    
    // If filename contains path separators, extract just the filename
    if (filename.includes(pathSeparator) || filename.includes('/') || filename.includes('\\')) {
      const separator = filename.includes('\\') ? '\\' : '/'
      const parts = filename.split(separator)
      finalFilename = parts[parts.length - 1] || filename
    }
    
    // Ensure filename has .beaki extension
    finalFilename = finalFilename.endsWith('.beaki')
      ? finalFilename
      : `${finalFilename}.beaki`

    // Combine directory path with filename
    const fullPath = handle.endsWith(pathSeparator)
      ? `${handle}${finalFilename}`
      : `${handle}${pathSeparator}${finalFilename}`

    await writeFile(fullPath, content)
    console.log(`File saved as: ${finalFilename} (saved directly to workspace folder: ${fullPath})`)
    return
  }

  // Browser File System Access API
  if (handle && 'getFileHandle' in handle) {
    // Extract just the filename from path if full path provided
    let finalFilename = filename
    if (filename.includes('/') || filename.includes('\\')) {
      const separator = filename.includes('\\') ? '\\' : '/'
      const parts = filename.split(separator)
      finalFilename = parts[parts.length - 1] || filename
    }
    
    finalFilename = finalFilename.endsWith('.beaki')
      ? finalFilename
      : `${finalFilename}.beaki`

    const fileHandle = await handle.getFileHandle(finalFilename, {
      create: true,
    })

    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()

    console.log(`File saved as: ${finalFilename} (saved directly to workspace folder)`)
    return
  }

  throw new Error('Invalid directory handle')
}

/**
 * Check if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  if (isTauri()) {
    try {
      return await invoke<boolean>('file_exists', { path })
    } catch (error) {
      console.error('Error checking file existence:', error)
      return false
    }
  }

  // Browser: can't check existence without File System Access API
  return false
}

/**
 * Check if path is a directory (Tauri only)
 */
export async function isDirectory(path: string): Promise<boolean> {
  if (isTauri()) {
    try {
      return await invoke<boolean>('is_directory', { path })
    } catch (error) {
      console.error('Error checking if path is directory:', error)
      return false
    }
  }

  // Browser: can't check without File System Access API
  return false
}

/**
 * Rename a file (Tauri only)
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  if (isTauri()) {
    try {
      await invoke('rename_file', { oldPath, newPath })
    } catch (error) {
      console.error('Error renaming file:', error)
      throw error
    }
  } else {
    throw new Error('File renaming is only available in Tauri')
  }
}

/**
 * Get Documents directory path (Tauri only)
 */
export async function getDocumentsDirectory(): Promise<string | null> {
  if (isTauri()) {
    try {
      return await invoke<string>('get_documents_directory')
    } catch (error) {
      console.error('Error getting Documents directory:', error)
      return null
    }
  }
  return null
}

/**
 * Ensure directory exists, creating it if necessary (Tauri only)
 */
export async function ensureDirectoryExists(path: string): Promise<void> {
  if (isTauri()) {
    try {
      await invoke('ensure_directory_exists', { path })
    } catch (error) {
      console.error('Error ensuring directory exists:', error)
      throw error
    }
  }
}

/**
 * Get default save directory (Documents/Beak Designs)
 */
export async function getDefaultSaveDirectory(): Promise<string | null> {
  if (isTauri()) {
    const documentsDir = await getDocumentsDirectory()
    if (!documentsDir) {
      return null
    }
    
    const pathSeparator = documentsDir.includes('\\') ? '\\' : '/'
    const beakDesignsDir = documentsDir.endsWith(pathSeparator)
      ? `${documentsDir}Beak Designs`
      : `${documentsDir}${pathSeparator}Beak Designs`
    
    // Ensure the directory exists
    try {
      await ensureDirectoryExists(beakDesignsDir)
    } catch (error) {
      console.error('Error creating Beak Designs directory:', error)
      // Continue anyway - the write might still work
    }
    
    return beakDesignsDir
  }
  return null
}

/**
 * Check if File System Access API is supported (browser) or Tauri is available
 */
export function isFileSystemAccessSupported(): boolean {
  if (isTauri()) {
    return true
  }

  if (typeof window === 'undefined') {
    return false
  }

  return 'showDirectoryPicker' in window && 'showSaveFilePicker' in window
}
