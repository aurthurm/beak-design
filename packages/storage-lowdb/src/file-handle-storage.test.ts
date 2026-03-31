// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getDirectoryHandle,
  saveFileToWorkspace,
} from './file-handle-storage'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('file-handle-storage', () => {
  it('returns null when indexeddb is unavailable', async () => {
    const original = window.indexedDB
    // @ts-expect-error test mutation
    delete window.indexedDB

    try {
      expect(await getDirectoryHandle()).toBeNull()
    } finally {
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: original })
    }
  })

  it('writes a beaki file to a directory handle', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const getFileHandle = vi.fn(async () => ({
      createWritable: async () => ({ write, close }),
    }))

    await saveFileToWorkspace(
      { getFileHandle } as unknown as FileSystemDirectoryHandle,
      'Design',
      '{"ok":true}'
    )

    expect(getFileHandle).toHaveBeenCalledWith('Design.beaki', { create: true })
    expect(write).toHaveBeenCalledWith('{"ok":true}')
    expect(close).toHaveBeenCalled()
  })
})
