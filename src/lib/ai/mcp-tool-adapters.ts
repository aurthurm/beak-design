import { toolDefinition } from '@tanstack/ai'
import type { ToolRegistry } from '../mcp-tools'
import { getToolContextProvider } from './tool-context-provider'

/**
 * Normalize MCP inputSchema to valid JSON Schema for TanStack AI.
 * TanStack AI accepts plain JSON Schema (avoids Zod _zod compatibility issues).
 */
function normalizeJsonSchema(schema: unknown): object {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {}, required: [] }
  }
  return schema as object
}

/**
 * Convert MCP tool definitions to TanStack AI tool format
 * Creates adapters that bridge MCP tools to TanStack AI
 */
export function createMcpToolAdapters(registry: ToolRegistry) {
  const toolDefs = registry.getToolDefinitions()
  const adapters: Array<{ def: any; server: any }> = []

  for (const toolDef of toolDefs) {
    // Use raw JSON Schema - TanStack AI supports it and avoids Zod _zod errors
    const inputSchema = normalizeJsonSchema(toolDef.inputSchema)

    // Create TanStack AI tool definition with plain JSON Schema
    const aiToolDef = toolDefinition({
      name: toolDef.name,
      description: toolDef.description,
      inputSchema,
      outputSchema: { type: 'object', additionalProperties: true },
    })

    // Create server implementation that calls MCP tool
    const serverImpl = aiToolDef.server(async (input: any) => {
      const contextProvider = getToolContextProvider()
      const ctx = contextProvider.createToolContext()

      try {
        const result = await registry.invoke(toolDef.name, input, ctx)
        return result
      } catch (error) {
        console.error(`[MCP Tool Adapter] Error executing ${toolDef.name}:`, error)
        
        // Return error in a format that TanStack AI can handle
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Tool execution failed: ${errorMessage}`)
      }
    })

    adapters.push({ def: aiToolDef, server: serverImpl })
  }

  return adapters
}

/**
 * Get tool definitions for TanStack AI
 * Returns tools ready to be registered with TanStack AI
 */
export function getMcpToolsForAI(registry: ToolRegistry) {
  const adapters = createMcpToolAdapters(registry)
  return adapters.map((adapter) => adapter.server)
}
