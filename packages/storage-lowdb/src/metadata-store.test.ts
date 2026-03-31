// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMetadataStore } from './metadata-store'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('createMetadataStore', () => {
  it('stores workspace and project history', async () => {
    const storeDirectoryHandle = vi.fn(async () => 'handle-1')
    const getDirectoryHandle = vi.fn(async () => ({ kind: 'directory' } as FileSystemDirectoryHandle))

    const store = createMetadataStore({
      isTauri: () => false,
      storeDirectoryHandle,
      getDirectoryHandle,
      now: () => '2026-01-01T00:00:00.000Z',
    })

    await store.initMetadataDb()

    const handle = { kind: 'directory' } as FileSystemDirectoryHandle
    await store.setCurrentWorkspace('/workspace/alpha', handle, 'Alpha')
    await store.addProjectToHistory('/workspace/alpha/doc.beaki', 'Doc', '/workspace/alpha')
    await store.updateProjectLastEdited('/workspace/alpha/doc.beaki')

    expect(store.getCurrentWorkspace()).toBe('/workspace/alpha')
    expect(store.getWorkspaceHistory()).toHaveLength(1)
    expect(store.getProjectHistory()).toHaveLength(1)
    expect(store.getLastOpenedProject()).toEqual({
      filePath: '/workspace/alpha/doc.beaki',
      name: 'Doc',
      lastOpened: '2026-01-01T00:00:00.000Z',
      lastEdited: '2026-01-01T00:00:00.000Z',
      workspacePath: '/workspace/alpha',
    })
    expect(store.getMostRecentlyEditedProject()).toEqual(store.getLastOpenedProject())
    expect(storeDirectoryHandle).toHaveBeenCalledTimes(1)
    expect(getDirectoryHandle).not.toHaveBeenCalled()
  })

  it('returns a stored directory handle when not on tauri', async () => {
    const handle = { kind: 'directory' } as FileSystemDirectoryHandle
    const getDirectoryHandle = vi.fn(async () => handle)

    const store = createMetadataStore({
      isTauri: () => false,
      storeDirectoryHandle: async () => 'handle-2',
      getDirectoryHandle,
      now: () => '2026-01-01T00:00:00.000Z',
    })

    await store.initMetadataDb()
    await store.setCurrentWorkspace('/workspace/beta', handle, 'Beta')

    expect(await store.getCurrentWorkspaceHandle()).toBe(handle)
    expect(getDirectoryHandle).toHaveBeenCalledWith('handle-2')
  })

  it('returns the workspace path directly on tauri', async () => {
    const store = createMetadataStore({
      isTauri: () => true,
      storeDirectoryHandle: async () => 'handle-3',
      getDirectoryHandle: async () => null,
      now: () => '2026-01-01T00:00:00.000Z',
    })

    await store.initMetadataDb()
    await store.setCurrentWorkspace('/workspace/gamma', null, 'Gamma')

    expect(await store.getCurrentWorkspaceHandle()).toBe('/workspace/gamma')
  })
})
