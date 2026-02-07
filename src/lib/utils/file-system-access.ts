/**
 * File System Access API utilities
 * Wrapper around Tauri file system API with browser fallback
 * Re-exports from tauri-fs for backward compatibility
 */

export {
  requestWorkspaceFolder,
  requestSaveLocation,
  isFileSystemAccessSupported,
} from './tauri-fs'

// Re-export types for backward compatibility
export type { } from './tauri-fs'
