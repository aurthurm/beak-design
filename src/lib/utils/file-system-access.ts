/**
 * File System Access API utilities
 * Wrapper around Tauri file system API with browser fallback
 * Re-exports from tauri-fs for backward compatibility
 */

export {
  requestWorkspaceFolder,
  requestSaveLocation,
  isFileSystemAccessSupported,
} from '../../../packages/platform-tauri/src/tauri-fs'

// Re-export types for backward compatibility
export type { } from '../../../packages/platform-tauri/src/tauri-fs'
