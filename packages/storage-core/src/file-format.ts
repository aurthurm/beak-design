import type { Document, SelectionState } from '../../schema/src'
import { SCHEMA_VERSION } from '../../schema/src'

export interface BeakiProject {
  _format: 'beaki-v1'
  version: string
  document: Document
  viewport?: {
    panX: number
    panY: number
    zoom: number
  }
  selection?: SelectionState
}

export function serializeBeaki(
  document: Document,
  viewport?: { panX: number; panY: number; zoom: number },
  selection?: SelectionState
): string {
  const project: BeakiProject = {
    _format: 'beaki-v1',
    version: SCHEMA_VERSION,
    document: {
      ...document,
      updatedAt: new Date().toISOString(),
    },
    ...(viewport && { viewport }),
    ...(selection && { selection }),
  }

  return JSON.stringify(project, null, 2)
}

export function deserializeBeaki(content: string): BeakiProject {
  const parsed = JSON.parse(content)

  if (parsed._format !== 'beaki-v1') {
    throw new Error('Invalid file format. Expected beaki-v1 format.')
  }

  if (!parsed.document || typeof parsed.document !== 'object') {
    throw new Error('Invalid file format. Missing document data.')
  }

  const document = parsed.document as Document
  if (!document.id || !document.schemaVersion || !document.pages || !document.frames || !document.layers) {
    throw new Error('Invalid document structure. Missing required fields.')
  }

  return parsed as BeakiProject
}
