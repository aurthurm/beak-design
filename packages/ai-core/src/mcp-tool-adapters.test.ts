import { describe, expect, it, vi } from 'vitest'

import { ToolRegistry } from '../../tool-core/src'

import { ToolContextProvider } from './tool-context-provider'
import { createMcpToolAdapters, getMcpToolsForAI } from './mcp-tool-adapters'

describe('mcp-tool-adapters', () => {
  it('wraps registered tools for TanStack AI', async () => {
    const registry = new ToolRegistry()
    registry.register({
      name: 'echo',
      description: 'Echo input',
      inputSchema: {},
      outputSchema: {},
      handler: async (input, ctx) => ({ input, activeDocumentId: ctx.activeDocumentId }),
    })

    const provider = new ToolContextProvider({
      ids: {
        doc: () => 'doc-2' as never,
        page: () => 'page-1' as never,
        frame: () => 'frame-1' as never,
        layer: () => 'layer-1' as never,
        component: () => 'component-1' as never,
        token: () => 'token-1' as never,
        transaction: () => 'tx-1' as never,
      } as never,
      nowISO: () => '2026-03-30T00:00:00.000Z',
      createEmptyDocument: vi.fn(),
      loadDocument: vi.fn(),
      saveDocument: vi.fn(),
      listRecent: vi.fn(),
      getCanvasDocument: vi.fn(() => null),
      setCanvasDocument: vi.fn(),
      getCanvasSelection: vi.fn(() => ({ pageId: null, selectedIds: [] })),
      setCanvasSelection: vi.fn(),
      exportFramePng: vi.fn(),
    })

    provider.setActiveDocumentId('doc-1' as never)
    const adapters = createMcpToolAdapters(registry, provider)
    expect(adapters[0].def.name).toBe('echo')
    expect(adapters[0].server).toBeTypeOf('object')
    expect(getMcpToolsForAI(registry, provider)).toHaveLength(1)
    expect(getMcpToolsForAI(registry, provider)[0]).toBeTypeOf('object')
  })
})
