import * as Y from 'yjs'
import type { YjsDocumentStructure } from './document'

/**
 * Yjs provider setup (disabled initially)
 * When collaboration is enabled, this will connect to a provider
 */

export type ProviderType = 'websocket' | 'indexeddb' | 'memory'

export interface YjsProvider {
  connect(): void
  disconnect(): void
  isConnected: boolean
}

/**
 * Create a Yjs provider (stub - no actual connection)
 */
export function createYjsProvider(
  ydoc: Y.Doc,
  type: ProviderType = 'memory',
  options?: any
): YjsProvider {
  // For now, return a stub provider that does nothing
  // When collaboration is enabled, this will create real providers
  
  return {
    connect: () => {
      // Stub - no connection
      console.log('[Yjs] Provider connect called (disabled)')
    },
    disconnect: () => {
      // Stub - no disconnection
      console.log('[Yjs] Provider disconnect called (disabled)')
    },
    isConnected: false,
  }
}

/**
 * Check if Yjs collaboration is enabled
 */
export function isYjsEnabled(): boolean {
  // For now, always return false
  // This can be controlled by user settings later
  return false
}

/**
 * Enable Yjs collaboration (stub)
 */
export function enableYjs(): void {
  console.log('[Yjs] Collaboration enable requested (not implemented yet)')
}

/**
 * Disable Yjs collaboration (stub)
 */
export function disableYjs(): void {
  console.log('[Yjs] Collaboration disable requested (not implemented yet)')
}
