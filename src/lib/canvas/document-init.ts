import type { Document, PageId, FrameId, LayerId } from '../schema'
import { SCHEMA_VERSION } from '../schema'
import { idGenerator } from '../db/id-generator'

/**
 * Create an empty document with a default page
 */
export function createEmptyDocument(name: string = 'Untitled'): Document {
  const docId = idGenerator.doc()
  const pageId = idGenerator.page()
  const now = new Date().toISOString()

  const document: Document = {
    id: docId,
    schemaVersion: SCHEMA_VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    activePageId: pageId,
    pages: {
      [pageId]: {
        id: pageId,
        documentId: docId,
        name: 'Page 1',
        frameIds: [],
        provenance: {
          createdAt: now,
          createdBy: { kind: 'user' },
        },
      },
    },
    frames: {},
    layers: {},
    components: {},
    tokens: {},
    assets: {},
  }

  return document
}

/**
 * Create a frame with default presets
 */
export function createFramePreset(
  preset: 'mobile' | 'tablet' | 'desktop' | 'custom',
  x: number = 0,
  y: number = 0
): { name: string; platform: any; rect: { x: number; y: number; w: number; h: number } } {
  const presets = {
    mobile: { name: 'iPhone 14', platform: 'mobile' as const, w: 390, h: 844 },
    tablet: { name: 'iPad', platform: 'tablet' as const, w: 820, h: 1180 },
    desktop: { name: 'Desktop', platform: 'desktop' as const, w: 1440, h: 900 },
    custom: { name: 'Custom Frame', platform: 'custom' as const, w: 400, h: 600 },
  }

  const presetData = presets[preset]
  return {
    name: presetData.name,
    platform: presetData.platform,
    rect: {
      x,
      y,
      w: presetData.w,
      h: presetData.h,
    },
  }
}
