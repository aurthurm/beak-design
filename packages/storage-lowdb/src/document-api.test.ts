import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  deleteDocument,
  getActiveDocumentId,
  getAllDocuments,
  getDocument,
  saveDocument,
  setActiveDocumentId,
} from './document-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('document-api', () => {
  it('saves and loads documents through fetch', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/documents') && init?.method === 'POST') {
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/documents/doc-1')) {
        return new Response(JSON.stringify({ id: 'doc-1' }), { status: 200 })
      }
      if (url.endsWith('/documents')) {
        return new Response(JSON.stringify([{ id: 'doc-1' }]), { status: 200 })
      }
      if (url.endsWith('/active') && init?.method === 'POST') {
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/active')) {
        return new Response(JSON.stringify({ documentId: 'doc-1' }), { status: 200 })
      }
      if (url.endsWith('/documents/doc-2') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return new Response(null, { status: 404 })
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(saveDocument({ id: 'doc-1' } as never)).resolves.toBeUndefined()
    await expect(getDocument('doc-1')).resolves.toEqual({ id: 'doc-1' })
    await expect(getAllDocuments()).resolves.toEqual([{ id: 'doc-1' }])
    await expect(setActiveDocumentId('doc-1')).resolves.toBeUndefined()
    await expect(getActiveDocumentId()).resolves.toBe('doc-1')
    await expect(deleteDocument('doc-2')).resolves.toBeUndefined()
  })

  it('returns null for missing documents', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    await expect(getDocument('missing')).resolves.toBeNull()
  })
})
