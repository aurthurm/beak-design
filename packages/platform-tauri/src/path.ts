/**
 * Get OS-aware path separator
 */
export function getPathSeparator(): string {
  if (typeof window === 'undefined') {
    return '/'
  }

  const platform = navigator.platform.toLowerCase()
  return platform.includes('win') ? '\\' : '/'
}

/**
 * Get OS-aware Documents directory path
 * Returns a virtual path representing Documents/Beak Designs folder
 */
export function getRootDirectory(): string {
  const separator = getPathSeparator()

  if (typeof window === 'undefined') {
    return `${separator}Documents${separator}Beak Designs`
  }

  const platform = navigator.platform.toLowerCase()
  if (platform.includes('win')) {
    return `C:${separator}Users${separator}User${separator}Documents${separator}Beak Designs`
  }

  if (platform.includes('mac')) {
    return `${separator}Users${separator}user${separator}Documents${separator}Beak Designs`
  }

  return `${separator}home${separator}user${separator}Documents${separator}Beak Designs`
}

/**
 * Create an OS-aware file path in the root directory
 * If workspace is provided, uses workspace instead of default Documents/Beak Designs
 */
export function createRootFilePath(filename: string, workspace?: string | null): string {
  const separator = getPathSeparator()
  const root = workspace || getRootDirectory()
  const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`

  return `${root}${separator}${finalFilename}`
}

/**
 * Get default file path for new documents
 * Files are saved to Documents/Beak Designs folder
 */
export function getDefaultFilePath(): string {
  return createRootFilePath('New-Design')
}
