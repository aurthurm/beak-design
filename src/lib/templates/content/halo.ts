import type { Document } from '../../schema'

/**
 * Halo Design System Template
 * A clean, minimal design system with soft edges and subtle gradients
 */
export function createHaloTemplate(): Document {
  const now = new Date().toISOString()
  const docId = `doc-halo-${Date.now()}` as any
  const pageId = `page-${Date.now()}` as any

  // TODO: Implement full Halo template with:
  // - Soft, rounded components
  // - Subtle gradient backgrounds
  // - Pastel color palette
  // - Gentle shadows and glows
  // - Modern sans-serif typography

  return {
    id: docId,
    schemaVersion: '1.0.0',
    name: 'Halo Design System',
    createdAt: now,
    updatedAt: now,
    activePageId: pageId,
    pages: {
      [pageId]: {
        id: pageId,
        documentId: docId,
        name: 'Components',
        frameIds: [],
        provenance: { createdAt: now, createdBy: { kind: 'user' } },
      },
    },
    frames: {},
    layers: {},
    tokens: {},
    components: {},
    assets: {},
  }
}
