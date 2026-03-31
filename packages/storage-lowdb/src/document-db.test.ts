import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { createDocumentDb, type Database } from './document-db'

function createTempDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'beak-storage-lowdb-'))
  return {
    dir,
    dbPath: join(dir, 'data.json'),
  }
}

afterEach(() => {
  // no-op; individual tests clean up their temp dirs
})

describe('createDocumentDb', () => {
  it('persists and retrieves documents', async () => {
    const { dir, dbPath } = createTempDbPath()
    try {
      const store = createDocumentDb({ dbPath })
      await store.initDb()

      const document: Database['documents'][string] = {
        id: 'doc-1',
        name: 'Test Document',
        schemaVersion: '1.0.0',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        activePageId: null,
        pages: {},
        frames: {},
        layers: {},
      }

      await store.saveDocument(document)

      expect(await store.getDocument('doc-1')).toEqual(document)
      expect(await store.getActiveDocumentId()).toBe('doc-1')
      expect(await store.getAllDocuments()).toEqual([document])

      await store.deleteDocument('doc-1')
      expect(await store.getDocument('doc-1')).toBeNull()
      expect(await store.getActiveDocumentId()).toBeNull()

      const raw = JSON.parse(readFileSync(dbPath, 'utf8')) as Database
      expect(raw.documents).toEqual({})
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('updates the active document independently', async () => {
    const { dir, dbPath } = createTempDbPath()
    try {
      const store = createDocumentDb({ dbPath })
      await store.initDb()
      await store.setActiveDocumentId('doc-2')
      expect(await store.getActiveDocumentId()).toBe('doc-2')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
