import type {
  Command,
  CommandBus,
  ToolContext,
  DocumentId,
  FrameId,
  LayerId,
  Rect,
  Patch,
} from '../mcp-tools'
import { canvasStore, canvasActions } from './store'
import { selectionActions } from './selection'

/**
 * Canvas command handler that wraps the MCP command bus
 * All canvas interactions should go through this layer
 */
export class CanvasCommandHandler {
  constructor(
    private commandBus: CommandBus,
    private context: ToolContext
  ) {}

  /**
   * Execute a command and update canvas state
   */
  async execute(command: Command): Promise<void> {
    const result = await this.commandBus.dispatch(command, this.context)

    if (result.ok) {
      // Update canvas state from document
      const docId = this.getDocumentIdFromCommand(command)
      if (docId) {
        const document = this.context.editor.getDocument(docId)
        if (document) {
          canvasActions.setDocument(document)
          
          // Update selection if it was affected
          if (this.isSelectionCommand(command)) {
            const selection = this.context.editor.getSelection()
            canvasActions.setSelection(selection)
          }
        }
      }
    } else {
      console.error('Command failed:', result.error)
      throw new Error(result.error.message)
    }
  }

  /**
   * Extract document ID from command
   */
  private getDocumentIdFromCommand(command: Command): DocumentId | null {
    if ('payload' in command && command.payload && typeof command.payload === 'object') {
      return (command.payload as any).docId ?? null
    }
    return null
  }

  /**
   * Check if command affects selection
   */
  private isSelectionCommand(command: Command): boolean {
    return command.type === 'selection.set' || command.type === 'layer.delete'
  }

  // Convenience methods for common operations

  async updateLayer(docId: DocumentId, layerId: LayerId, patch: Patch<any>): Promise<void> {
    await this.execute({
      type: 'layer.update',
      payload: { docId, layerId, patch },
    })
  }

  async updateFrame(docId: DocumentId, frameId: FrameId, patch: Patch<any>): Promise<void> {
    await this.execute({
      type: 'frame.update',
      payload: { docId, frameId, patch },
    })
  }

  async setSelection(docId: DocumentId, selection: { pageId: string | null; selectedIds: Array<FrameId | LayerId> }): Promise<void> {
    await this.execute({
      type: 'selection.set',
      payload: { docId, selection },
    })
  }

  async createLayer(docId: DocumentId, layerId: LayerId, input: any): Promise<void> {
    await this.execute({
      type: 'layer.create',
      payload: { docId, layerId, input },
    })
  }

  async deleteLayer(docId: DocumentId, layerId: LayerId): Promise<void> {
    await this.execute({
      type: 'layer.delete',
      payload: { docId, layerId },
    })
  }

  async createFrame(docId: DocumentId, frameId: FrameId, input: any): Promise<void> {
    await this.execute({
      type: 'frame.create',
      payload: { docId, frameId, input },
    })
  }
}

/**
 * Create a canvas command handler instance
 */
export function createCanvasCommandHandler(
  commandBus: CommandBus,
  context: ToolContext
): CanvasCommandHandler {
  return new CanvasCommandHandler(commandBus, context)
}
