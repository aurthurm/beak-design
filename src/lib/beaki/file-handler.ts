export { type BeakiProject, deserializeBeaki, serializeBeaki } from '../../../packages/storage-core/src'

/**
 * Extract filename from a file path (handles both Windows and Unix paths)
 */
function extractFilename(filePath: string): string {
  // Handle both Windows (\) and Unix (/) path separators
  const separator = filePath.includes('\\') ? '\\' : '/'
  const parts = filePath.split(separator)
  return parts[parts.length - 1] || filePath
}

/**
 * Download file using browser File API
 * Note: Files are saved to the browser's default Downloads folder
 * The filename parameter can be a full path, but only the filename will be used
 */
export function downloadBeakiFile(content: string, filename: string = 'untitled.beaki'): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  
  // Extract just the filename from path (browser downloads don't support full paths)
  const extractedFilename = extractFilename(filename)
  link.download = extractedFilename.endsWith('.beaki') ? extractedFilename : `${extractedFilename}.beaki`
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  // Log where the file was saved (browser Downloads folder)
  console.log(`File saved as: ${link.download} (saved to browser Downloads folder)`)
}

/**
 * Save file to workspace using Tauri or File System Access API
 * This allows saving directly to the selected workspace folder
 */
export async function saveBeakiFileToWorkspace(
  handle: string | FileSystemDirectoryHandle,
  content: string,
  filename: string = 'untitled.beaki'
): Promise<void> {
  const { saveFileToWorkspace } = await import('@/lib/utils/tauri-fs')
  
  // Extract just the filename from path
  const extractedFilename = extractFilename(filename)
  const finalFilename = extractedFilename.endsWith('.beaki') ? extractedFilename : `${extractedFilename}.beaki`
  
  await saveFileToWorkspace(handle, finalFilename, content)
}

/**
 * Read file using browser File API
 */
export function readBeakiFile(file: File): Promise<BeakiProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const project = deserializeBeaki(content)
        resolve(project)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsText(file)
  })
}

/**
 * Open file picker and load .beaki file
 * Uses Tauri dialog when available, falls back to browser file input
 * Returns both the project and the file path
 */
export async function openBeakiFile(): Promise<{ project: BeakiProject; filePath: string } | null> {
  const { openFilePicker, readFile, isTauri, isDirectory } = await import('@/lib/utils/tauri-fs')
  
  try {
    const pathOrFile = await openFilePicker()
    if (!pathOrFile) {
      return null
    }

    // Handle Tauri path (string) or browser File object
    let content: string
    let filePath: string
    
    if (isTauri() && typeof pathOrFile === 'string') {
      // Tauri: validate that it's a file, not a directory
      filePath = pathOrFile
      const isDir = await isDirectory(filePath)
      if (isDir) {
        alert('Please select a file, not a directory.')
        return null
      }
      content = await readFile(pathOrFile)
    } else if (typeof pathOrFile === 'string') {
      // String path but not Tauri (shouldn't happen, but handle it)
      filePath = pathOrFile
      content = await readFile(pathOrFile)
    } else {
      // Browser: read File object, use file name
      filePath = pathOrFile.name
      content = await readFile(pathOrFile)
    }

    const project = deserializeBeaki(content)
    return { project, filePath }
  } catch (error) {
    console.error('Failed to load file:', error)
    alert(`Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return null
  }
}
