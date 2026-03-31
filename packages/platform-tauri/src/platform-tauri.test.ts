import { describe, expect, it } from 'vitest'

import {
  detectCLITools,
  detectMCPServers,
  detectOllama,
  getDefaultSaveDirectory,
  isFileSystemAccessSupported,
  listProcesses,
  openFilePicker,
} from './index'

describe('platform-tauri fallbacks', () => {
  it('returns non-tauri fallbacks in node', async () => {
    expect(await detectCLITools()).toEqual([])
    expect(await detectMCPServers()).toEqual([])
    expect(await detectOllama()).toEqual({
      available: false,
      models: [],
      error: 'Not running in Tauri context',
    })
    expect(await listProcesses()).toEqual([])
    expect(await getDefaultSaveDirectory()).toBeNull()
    expect(await openFilePicker()).toBeNull()
    expect(isFileSystemAccessSupported()).toBe(false)
  })
})
