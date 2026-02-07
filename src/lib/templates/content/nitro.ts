import type { Document } from '../../schema'

/**
 * Nitro Design System Template
 * A high-energy, bold design system with sharp edges and vibrant colors
 */
export function createNitroTemplate(): Document {
  const now = new Date().toISOString()
  const docId = `doc-nitro-${Date.now()}` as any
  const pageId = `page-${Date.now()}` as any

  // TODO: Implement full Nitro template with:
  // - Bold, angular components
  // - High-contrast colors
  // - Sharp corners and edges
  // - Energetic, modern feel
  // - Strong typography with geometric fonts

  return {
    id: docId,
    schemaVersion: '1.0.0',
    name: 'Nitro Design System',
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
