import type { AppMetadata } from './metadata-store'
import type { Database } from './document-db'
import type { User } from './users-db'

export interface StorageSnapshot {
  _format: 'beak-storage-snapshot-v1'
  exportedAt: string
  activeDocumentId: string | null
  documents: Database['documents'][string][]
  metadata: AppMetadata
  users: User[]
}

export interface StorageSnapshotInput {
  activeDocumentId: string | null
  documents: Database['documents'][string][]
  metadata: AppMetadata
  users: User[]
  exportedAt?: string
}

export function createStorageSnapshot(input: StorageSnapshotInput): StorageSnapshot {
  return {
    _format: 'beak-storage-snapshot-v1',
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    activeDocumentId: input.activeDocumentId,
    documents: input.documents,
    metadata: input.metadata,
    users: input.users,
  }
}

export function parseStorageSnapshot(content: string): StorageSnapshot {
  const parsed = JSON.parse(content) as StorageSnapshot

  if (parsed._format !== 'beak-storage-snapshot-v1') {
    throw new Error('Invalid storage snapshot format. Expected beak-storage-snapshot-v1.')
  }

  if (!Array.isArray(parsed.documents) || !parsed.metadata || !Array.isArray(parsed.users)) {
    throw new Error('Invalid storage snapshot structure.')
  }

  return parsed
}

export function serializeStorageSnapshot(snapshot: StorageSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}
