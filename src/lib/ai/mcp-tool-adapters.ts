import type { ToolRegistry } from '../mcp-tools'
import { getToolContextProvider } from './tool-context-provider'
import {
  createMcpToolAdapters as createPackageMcpToolAdapters,
  getMcpToolsForAI as getPackageMcpToolsForAI,
} from '../../../packages/ai-core/src/mcp-tool-adapters'

export function createMcpToolAdapters(registry: ToolRegistry) {
  return createPackageMcpToolAdapters(registry, getToolContextProvider())
}

export function getMcpToolsForAI(registry: ToolRegistry) {
  return getPackageMcpToolsForAI(registry, getToolContextProvider())
}
