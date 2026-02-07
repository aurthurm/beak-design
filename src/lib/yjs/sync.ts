import * as Y from 'yjs'
import type { Document } from '../schema'
import type { YjsDocumentStructure } from './document'
import { isYjsEnabled } from './provider'

/**
 * Sync logic between Document and Yjs
 * This is stubbed out until collaboration is enabled
 */

/**
 * Initialize Yjs document from regular document
 */
export function initializeYjsFromDocument(
  document: Document,
  yjsDoc: YjsDocumentStructure
): void {
  if (!isYjsEnabled()) {
    return // Do nothing if Yjs is disabled
  }

  // Stub - will sync document structure to Yjs when enabled
  // This would populate yjsDoc with document data
}

/**
 * Sync changes from Yjs to Document
 */
export function syncYjsChangesToDocument(
  yjsDoc: YjsDocumentStructure,
  onUpdate: (document: Document) => void
): () => void {
  if (!isYjsEnabled()) {
    return () => {} // Return no-op unsubscribe
  }

  // Stub - will observe Yjs changes and convert to Document updates
  const observer = () => {
    // Convert Yjs structure to Document and call onUpdate
  }

  // For now, return no-op unsubscribe
  return () => {}
}

/**
 * Sync changes from Document to Yjs
 */
export function syncDocumentChangesToYjs(
  document: Document,
  yjsDoc: YjsDocumentStructure
): void {
  if (!isYjsEnabled()) {
    return // Do nothing if Yjs is disabled
  }

  // Stub - will sync document changes to Yjs when enabled
}

/**
 * Create a transaction wrapper for Yjs updates
 */
export function withYjsTransaction<T>(
  yjsDoc: YjsDocumentStructure,
  fn: () => T
): T {
  if (!isYjsEnabled()) {
    return fn() // Just execute normally if Yjs is disabled
  }

  // Stub - will wrap in Yjs transaction when enabled
  return fn()
}
