import type { AgentConfig } from './agent-config'

export type DocumentContext = {
  documentName?: string
  documentId?: string
  activePageId?: string
  frameCount?: number
  layerCount?: number
}

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export function getModelFromConfig(agentConfig?: AgentConfig): string {
  if (agentConfig?.metadata?.model) {
    return agentConfig.metadata.model
  }
  return 'claude-3-5-sonnet-20241022'
}

export function buildSystemPrompt(
  selectedIDs: string[],
  documentContext?: DocumentContext
): string {
  let prompt = `You are an AI design assistant helping users create and modify designs in a canvas-based design tool.

Available Tools:
- batch_design: Execute multiple design operations (Insert, Copy, Replace, Move, Delete, Update)
- search_design_nodes: Search for nodes in the document tree
- get_editor_state: Get current editor state
- document_tree: Get full document structure
- selection_state: Get current selection
- design_tokens: Get design tokens
- create_frame, update_frame, delete_frame: Frame operations
- create_layer, update_layer, delete_layer: Layer operations
- export_frame_png: Export frame as PNG

When modifying designs, use batch_design for multiple operations. Always use the active document context.

Current Context:
`

  if (documentContext) {
    if (documentContext.documentName) {
      prompt += `- Active Document: ${documentContext.documentName}${documentContext.documentId ? ` (${documentContext.documentId})` : ''}\n`
    }
    if (documentContext.activePageId) {
      prompt += `- Active Page: ${documentContext.activePageId}\n`
    }
    if (documentContext.frameCount !== undefined) {
      prompt += `- Total Frames: ${documentContext.frameCount}\n`
    }
    if (documentContext.layerCount !== undefined) {
      prompt += `- Total Layers: ${documentContext.layerCount}\n`
    }
  }

  if (selectedIDs.length > 0) {
    prompt += `- Selected Objects: ${selectedIDs.join(', ')}\n`
  }

  prompt += `
Instructions:
- Use batch_design for creating/modifying multiple elements at once
- Be concise and helpful
- When asked to create designs, use appropriate tools
- Always confirm what you're doing before making changes
`

  return prompt
}

export function normalizeChatMessages(
  messages: Array<{ role: string; text?: string; content?: string }>
): ChatMessage[] {
  return messages.map((msg) => {
    if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
      return {
        role: msg.role,
        content: msg.text || msg.content || '',
      }
    }

    return {
      role: 'assistant',
      content: msg.text || msg.content || '',
    }
  })
}
