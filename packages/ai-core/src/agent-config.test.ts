import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createConfigFromAgentInfo,
  deleteAgentConfig,
  getAgentConfig,
  getAgentConfigs,
  getDefaultAgentId,
  mergeAgentsWithConfigs,
  saveAgentConfig,
  setDefaultAgentId,
  validateAgentConfig,
} from './agent-config'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    clear: () => {
      store = {}
    },
    getItem: (key: string) => (key in store ? store[key] : null),
    removeItem: (key: string) => {
      delete store[key]
    },
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
  }
})()

beforeEach(() => {
  vi.stubGlobal('window', {})
  vi.stubGlobal('localStorage', localStorageMock)
  localStorageMock.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorageMock.clear()
})

describe('ai-core agent config', () => {
  it('persists configs and default agent id', () => {
    saveAgentConfig({
      id: 'ollama-local',
      name: 'Ollama',
      type: 'ollama',
      endpoint: 'http://localhost:11434',
      enabled: true,
    })
    setDefaultAgentId('ollama-local')

    expect(getAgentConfigs()).toHaveLength(1)
    expect(getAgentConfig('ollama-local')?.endpoint).toBe('http://localhost:11434')
    expect(getDefaultAgentId()).toBe('ollama-local')
  })

  it('merges detected agents with saved configs', () => {
    vi.stubGlobal('window', {})
    saveAgentConfig({
      id: 'mcp-1',
      name: 'MCP One',
      type: 'mcp',
      command: 'node',
      enabled: false,
    })

    const merged = mergeAgentsWithConfigs([
      { id: 'mcp-1', name: 'MCP One', type: 'mcp', status: 'available', command: 'node' },
      { id: 'cli-1', name: 'CLI One', type: 'cli', status: 'available', command: '/usr/bin/cli' },
    ])

    expect(merged).toHaveLength(2)
    expect(merged[0].enabled).toBe(false)
    expect(merged[1].id).toBe('cli-1')
  })

  it('validates configs and creates agent config from detected info', () => {
    const config = createConfigFromAgentInfo({
      id: 'ollama-local',
      name: 'Ollama',
      type: 'ollama',
      status: 'available',
      endpoint: 'http://localhost:11434',
      metadata: { models: ['llama3'] },
    })

    expect(config.model).toBe('llama3')
    expect(validateAgentConfig(config)).toEqual({ valid: true, errors: [] })
    expect(validateAgentConfig({ id: '', name: '', type: 'mcp', enabled: true })).toEqual({
      valid: false,
      errors: ['Agent ID is required', 'Agent name is required', 'MCP agent requires endpoint or command'],
    })
  })

  it('deletes configs', () => {
    saveAgentConfig({
      id: 'to-delete',
      name: 'Delete',
      type: 'cloud',
      enabled: true,
    })
    deleteAgentConfig('to-delete')

    expect(getAgentConfigs()).toHaveLength(0)
  })
})
