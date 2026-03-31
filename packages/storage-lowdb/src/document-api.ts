import type { Document } from '../../../schema'

const API_BASE = '/api/db'

export async function saveDocument(document: Document): Promise<void> {
  const response = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  })

  if (!response.ok) {
    throw new Error(`Failed to save document: ${response.statusText}`)
  }
}

export async function getDocument(documentId: string): Promise<Document | null> {
  const response = await fetch(`${API_BASE}/documents/${documentId}`)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Failed to get document: ${response.statusText}`)
  }
  return response.json()
}

export async function getAllDocuments(): Promise<Document[]> {
  const response = await fetch(`${API_BASE}/documents`)
  if (!response.ok) {
    throw new Error(`Failed to get documents: ${response.statusText}`)
  }
  return response.json()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`)
  }
}

export async function getActiveDocumentId(): Promise<string | null> {
  const response = await fetch(`${API_BASE}/active`)
  if (!response.ok) {
    return null
  }
  const data = await response.json()
  return data.documentId || null
}

export async function setActiveDocumentId(documentId: string | null): Promise<void> {
  const response = await fetch(`${API_BASE}/active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId }),
  })

  if (!response.ok) {
    throw new Error(`Failed to set active document: ${response.statusText}`)
  }
}
