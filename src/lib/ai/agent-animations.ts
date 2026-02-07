import { flashNodeOnAgentOperation, highlightAgentOperation } from '../canvas/animations'
import type { FrameId, LayerId } from '../schema'

/**
 * Connect agent operations to canvas animations
 * Triggers visual feedback when agents modify nodes
 */

/**
 * Extract node IDs from MCP tool result
 * Handles various tool result formats
 */
function extractNodeIdsFromToolResult(
  toolName: string,
  result: any
): Array<FrameId | LayerId> {
  const nodeIds: Array<FrameId | LayerId> = []

  if (!result || typeof result !== 'object') {
    return nodeIds
  }

  // Handle batch_design result
  if (toolName === 'batch_design' && result.createdNodes) {
    // Extract IDs from created nodes
    if (Array.isArray(result.createdNodes)) {
      result.createdNodes.forEach((node: any) => {
        if (node.id) nodeIds.push(node.id)
        if (node.children) {
          node.children.forEach((child: any) => {
            if (child.id) nodeIds.push(child.id)
          })
        }
      })
    }
  }

  // Handle individual create operations
  if (result.layerId) nodeIds.push(result.layerId as LayerId)
  if (result.frameId) nodeIds.push(result.frameId as FrameId)
  if (result.groupId) nodeIds.push(result.groupId as LayerId)
  if (result.componentId) {
    // Component ID is not a node ID, but we can highlight it
    // For now, skip components
  }

  // Handle arrays of IDs
  if (Array.isArray(result)) {
    result.forEach((item) => {
      if (typeof item === 'string') {
        nodeIds.push(item as FrameId | LayerId)
      } else if (item?.id) {
        nodeIds.push(item.id)
      }
    })
  }

  // Handle object with IDs array
  if (result.ids && Array.isArray(result.ids)) {
    result.ids.forEach((id: string) => {
      nodeIds.push(id as FrameId | LayerId)
    })
  }

  return nodeIds
}

/**
 * Trigger animations for agent tool execution
 * Called when an MCP tool completes successfully
 */
export function triggerAgentOperationAnimation(
  toolName: string,
  result: any,
  isError: boolean = false
): void {
  if (isError) {
    // Don't animate on error, or use error color
    return
  }

  const nodeIds = extractNodeIdsFromToolResult(toolName, result)

  if (nodeIds.length === 0) {
    return
  }

  // Flash all affected nodes
  nodeIds.forEach((nodeId) => {
    flashNodeOnAgentOperation(nodeId)
  })

  // For batch operations, also highlight briefly
  if (toolName === 'batch_design' && nodeIds.length > 1) {
    highlightAgentOperation(nodeIds)
  }
}

/**
 * Listen for tool executions and trigger animations
 * This should be called when tool results are received
 */
export function handleToolExecutionAnimation(
  toolName: string,
  toolInput: any,
  toolOutput: any,
  isError: boolean = false
): void {
  triggerAgentOperationAnimation(toolName, toolOutput, isError)
}
