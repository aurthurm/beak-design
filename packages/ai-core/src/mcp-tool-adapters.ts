import { toolDefinition } from '@tanstack/ai'

import type { ToolRegistry } from '../../tool-core/src'

import { ToolContextProvider } from './tool-context-provider'

function normalizeJsonSchema(schema: unknown): object {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {}, required: [] }
  }
  return schema as object
}

export function createMcpToolAdapters(
  registry: ToolRegistry,
  contextProvider: ToolContextProvider
) {
  const toolDefs = registry.getToolDefinitions()
  const adapters: Array<{ def: any; server: any }> = []

  for (const toolDef of toolDefs) {
    const inputSchema = normalizeJsonSchema(toolDef.inputSchema)

    const aiToolDef = toolDefinition({
      name: toolDef.name,
      description: toolDef.description,
      inputSchema,
      outputSchema: { type: 'object', additionalProperties: true },
    })

    const serverImpl = aiToolDef.server(async (input: any) => {
      const ctx = contextProvider.createToolContext()

      try {
        return await registry.invoke(toolDef.name, input, ctx)
      } catch (error) {
        console.error(`[MCP Tool Adapter] Error executing ${toolDef.name}:`, error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Tool execution failed: ${errorMessage}`)
      }
    })

    adapters.push({ def: aiToolDef, server: serverImpl })
  }

  return adapters
}

export function getMcpToolsForAI(registry: ToolRegistry, contextProvider: ToolContextProvider) {
  return createMcpToolAdapters(registry, contextProvider).map((adapter) => adapter.server)
}
