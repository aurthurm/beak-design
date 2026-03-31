import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import type { Document } from '../../schema/src'

export interface Database {
  documents: Record<string, Document>
  activeDocumentId: string | null
}

export interface DocumentDbOptions {
  dbPath?: string
}

function createDefaultData(): Database {
  return {
    documents: {},
    activeDocumentId: null,
  }
}

export interface DocumentDbStore {
  db: Low<Database>
  initDb(): Promise<void>
  saveDocument(document: Document): Promise<void>
  getDocument(documentId: string): Promise<Document | null>
  getAllDocuments(): Promise<Document[]>
  deleteDocument(documentId: string): Promise<void>
  getActiveDocumentId(): Promise<string | null>
  setActiveDocumentId(documentId: string | null): Promise<void>
}

export function createDocumentDb(options: DocumentDbOptions = {}): DocumentDbStore {
  const dbPath = options.dbPath ?? join(process.cwd(), 'db', 'data.json')
  const defaultData = createDefaultData()
  const db = new Low(new JSONFile<Database>(dbPath), defaultData)
  let isInitialized = false

  async function initDb(): Promise<void> {
    if (isInitialized) return
    mkdirSync(dirname(dbPath), { recursive: true })
    await db.read()
    if (!db.data) {
      db.data = createDefaultData()
      await db.write()
    }
    isInitialized = true
  }

  async function ensureInitialized(): Promise<void> {
    if (!isInitialized) {
      await initDb()
    }
  }

  async function saveDocument(document: Document): Promise<void> {
    await ensureInitialized()
    await db.read()
    if (!db.data) {
      db.data = createDefaultData()
    }
    db.data.documents[document.id] = document
    db.data.activeDocumentId = document.id
    await db.write()
  }

  async function getDocument(documentId: string): Promise<Document | null> {
    await ensureInitialized()
    await db.read()
    if (!db.data) {
      return null
    }
    return db.data.documents[documentId] || null
  }

  async function getAllDocuments(): Promise<Document[]> {
    await ensureInitialized()
    await db.read()
    if (!db.data) {
      return []
    }
    return Object.values(db.data.documents)
  }

  async function deleteDocument(documentId: string): Promise<void> {
    await ensureInitialized()
    await db.read()
    if (!db.data) {
      return
    }
    delete db.data.documents[documentId]
    if (db.data.activeDocumentId === documentId) {
      db.data.activeDocumentId = null
    }
    await db.write()
  }

  async function getActiveDocumentId(): Promise<string | null> {
    await ensureInitialized()
    await db.read()
    if (!db.data) {
      return null
    }
    return db.data.activeDocumentId
  }

  async function setActiveDocumentId(documentId: string | null): Promise<void> {
    await ensureInitialized()
    await db.read()
    if (!db.data) {
      db.data = createDefaultData()
    }
    db.data.activeDocumentId = documentId
    await db.write()
  }

  return {
    db,
    initDb,
    saveDocument,
    getDocument,
    getAllDocuments,
    deleteDocument,
    getActiveDocumentId,
    setActiveDocumentId,
  }
}

const defaultStore = createDocumentDb()

export const db = defaultStore.db
export const initDb = defaultStore.initDb
export const saveDocument = defaultStore.saveDocument
export const getDocument = defaultStore.getDocument
export const getAllDocuments = defaultStore.getAllDocuments
export const deleteDocument = defaultStore.deleteDocument
export const getActiveDocumentId = defaultStore.getActiveDocumentId
export const setActiveDocumentId = defaultStore.setActiveDocumentId
