/**
 * Get OS-aware path separator
 */
export function getPathSeparator(): string {
  // Detect OS from user agent or platform
  if (typeof window === 'undefined') {
    return '/' // Default to Unix-style
  }
  
  const platform = navigator.platform.toLowerCase()
  if (platform.includes('win')) {
    return '\\'
  }
  return '/'
}

/**
 * Get OS-aware Documents directory path
 * Returns a virtual path representing Documents/Beak Designs folder
 * This works across all OSes: Windows, Mac, and Linux all have Documents folder
 */
export function getRootDirectory(): string {
  const separator = getPathSeparator()
  
  if (typeof window === 'undefined') {
    return separator + 'Documents' + separator + 'Beak Designs'
  }
  
  const platform = navigator.platform.toLowerCase()
  if (platform.includes('win')) {
    // Windows: C:\Users\<username>\Documents\Beak Designs
    // In browser, we use a generic path since we can't detect actual username
    return 'C:' + separator + 'Users' + separator + 'User' + separator + 'Documents' + separator + 'Beak Designs'
  }
  
  // Unix/Mac: /home/<username>/Documents/Beak Designs or /Users/<username>/Documents/Beak Designs
  // In browser, we use a generic path since we can't detect actual username
  const isMac = platform.includes('mac')
  if (isMac) {
    return separator + 'Users' + separator + 'user' + separator + 'Documents' + separator + 'Beak Designs'
  }
  
  // Linux: /home/<username>/Documents/Beak Designs
  return separator + 'home' + separator + 'user' + separator + 'Documents' + separator + 'Beak Designs'
}

/**
 * Create an OS-aware file path in the root directory
 * If workspace is provided, uses workspace instead of default Documents/Beak Designs
 */
export function createRootFilePath(filename: string, workspace?: string | null): string {
  const separator = getPathSeparator()
  const root = workspace || getRootDirectory()
  
  // Ensure filename has .beaki extension
  const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
  
  // Join root directory with filename using OS-aware separator
  return root + separator + finalFilename
}

/**
 * Get default file path for new documents
 * Files are saved to Documents/Beak Designs folder
 */
export function getDefaultFilePath(): string {
  return createRootFilePath('New-Design')
}
