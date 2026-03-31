import { describe, expect, it } from 'vitest'

import { createStorageSnapshot, parseStorageSnapshot, serializeStorageSnapshot } from './recovery'

describe('storage-lowdb recovery', () => {
  it('serializes and parses a storage snapshot round-trip', () => {
    const snapshot = createStorageSnapshot({
      activeDocumentId: 'doc-1',
      documents: [
        {
          id: 'doc-1',
          name: 'Document',
          schemaVersion: '1.0.0',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          activePageId: null,
          pages: {},
          frames: {},
          layers: {},
        } as any,
      ],
      metadata: {
        currentWorkspace: '/workspace',
        currentWorkspaceHandleId: null,
        projectHistory: [],
        workspaceHistory: [],
        lastOpenedProject: null,
      },
      users: [{ username: 'admin', password: 'admin' }],
      exportedAt: '2026-02-01T00:00:00.000Z',
    })

    const parsed = parseStorageSnapshot(serializeStorageSnapshot(snapshot))

    expect(parsed).toEqual(snapshot)
  })

  it('rejects unsupported formats', () => {
    expect(() => parseStorageSnapshot(JSON.stringify({ _format: 'other' }))).toThrow(
      'Invalid storage snapshot format. Expected beak-storage-snapshot-v1.'
    )
  })
})
