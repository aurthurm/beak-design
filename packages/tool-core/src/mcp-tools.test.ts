import { describe, expect, it, vi } from 'vitest'

import { buildMcpToolGroups } from './mcp-tools'
import type { ToolContext, CommandBus, TransactionManager } from './tool-core'

const ctx = {
  activeDocumentId: 'doc-1',
  actor: 'user-1',
  storage: {
    createEmptyDocument: vi.fn(),
    loadDocument: vi.fn(),
    saveDocument: vi.fn(),
    listRecent: vi.fn(),
  },
  editor: {
    getDocument: vi.fn(() => null),
    setDocument: vi.fn(),
    getSelection: vi.fn(() => ({ pageId: 'page-1', selectedIds: [] })),
    setSelection: vi.fn(),
    exportFramePng: vi.fn(),
  },
  ids: {
    doc: vi.fn(() => 'doc-2'),
    page: vi.fn(() => 'page-2'),
    frame: vi.fn(() => 'frame-2'),
    layer: vi.fn(() => 'layer-2'),
    component: vi.fn(() => 'component-2'),
    token: vi.fn(() => 'token-2'),
    transaction: vi.fn(() => 'tx-2'),
  },
  nowISO: () => '2026-01-01T00:00:00.000Z',
} satisfies ToolContext

describe('buildMcpTools', () => {
  it('registers tools and executes read-only helpers', async () => {
    const commands = {
      dispatch: vi.fn(),
    } satisfies CommandBus

    const tx = {
      begin: vi.fn(async () => 'tx-1'),
      commit: vi.fn(),
      rollback: vi.fn(),
      inTransaction: vi.fn(),
    } satisfies TransactionManager

    const { registry, groups } = buildMcpToolGroups({ commands, tx })

    const definitions = registry.getToolDefinitions()
    expect(definitions.some((tool) => tool.name === 'get_editor_state')).toBe(true)
    expect(definitions.some((tool) => tool.name === 'begin_transaction')).toBe(true)
    expect(groups.read.some((tool) => tool.name === 'get_editor_state')).toBe(true)
    expect(groups.mutate.some((tool) => tool.name === 'begin_transaction')).toBe(true)
    expect(groups.read.every((tool) => tool.capabilities?.access === 'read')).toBe(true)
    expect(groups.mutate.every((tool) => tool.capabilities?.access === 'mutate')).toBe(true)

    await expect(registry.invoke('get_editor_state', {}, ctx)).resolves.toMatchObject({
      activeDocumentId: 'doc-1',
      selection: { pageId: 'page-1', selectedIds: [] },
    })

    await expect(registry.invoke('begin_transaction', { name: 'Batch edit' }, ctx)).resolves.toEqual({
      txId: 'tx-1',
    })
  })
})
