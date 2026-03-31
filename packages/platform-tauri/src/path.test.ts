import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createRootFilePath,
  getDefaultFilePath,
  getPathSeparator,
  getRootDirectory,
} from './path'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('path helpers', () => {
  it('uses unix defaults when window is unavailable', () => {
    expect(getPathSeparator()).toBe('/')
    expect(getRootDirectory()).toBe('/Documents/Beak Designs')
    expect(getDefaultFilePath()).toBe('/Documents/Beak Designs/New-Design.beaki')
  })

  it('builds windows paths when the platform is windows', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', { platform: 'Win32' })

    expect(getPathSeparator()).toBe('\\')
    expect(getRootDirectory()).toBe('C:\\Users\\User\\Documents\\Beak Designs')
    expect(createRootFilePath('New-Design', 'C:\\Workspace')).toBe('C:\\Workspace\\New-Design.beaki')
  })
})
