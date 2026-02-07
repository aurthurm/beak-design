import * as Y from 'yjs'
import type { Document } from '../schema'

/**
 * Yjs document structure for collaboration
 * This is set up but disabled initially
 */

export type YjsDocumentStructure = {
  document: Y.Map<any>
  pages: Y.Map<Y.Map<any>>
  frames: Y.Map<Y.Map<any>>
  layers: Y.Map<Y.Map<any>>
  components: Y.Map<Y.Map<any>>
  tokens: Y.Map<Y.Map<any>>
  selection: Y.Map<any>
}

/**
 * Create a Yjs document structure matching our schema
 */
export function createYjsDocument(): YjsDocumentStructure {
  const ydoc = new Y.Doc()

  const document = ydoc.getMap('document')
  const pages = ydoc.getMap('pages')
  const frames = ydoc.getMap('frames')
  const layers = ydoc.getMap('layers')
  const components = ydoc.getMap('components')
  const tokens = ydoc.getMap('tokens')
  const selection = ydoc.getMap('selection')

  return {
    document,
    pages,
    frames,
    layers,
    components,
    tokens,
    selection,
  }
}

/**
 * Sync document state to Yjs (stub - will be implemented when enabled)
 */
export function syncDocumentToYjs(
  document: Document,
  yjsDoc: YjsDocumentStructure
): void {
  // Disabled for now - will sync when collaboration is enabled
  // This would convert Document to Yjs structure
}

/**
 * Sync Yjs state to document (stub - will be implemented when enabled)
 */
export function syncYjsToDocument(
  yjsDoc: YjsDocumentStructure
): Document | null {
  // Disabled for now - will sync when collaboration is enabled
  // This would convert Yjs structure to Document
  return null
}
