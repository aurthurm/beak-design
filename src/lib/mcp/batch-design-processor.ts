import type { CommandBus, ToolContext, DocumentId, FrameId, LayerId } from '../mcp-tools'
import { canvasStore } from '../canvas/store'
import * as acorn from 'acorn'

/**
 * Batch Design Processor
 * Processes batch design operations from AI agents
 * Adapted from reference implementation for Konva-based system
 */
export class BatchDesignProcessor {
  private commandBus: CommandBus
  private toolCalls: Map<string, BatchDesignToolCall>

  constructor(commandBus: CommandBus) {
    this.commandBus = commandBus
    this.toolCalls = new Map()
  }

  async process(
    ctx: ToolContext,
    partial: boolean,
    operations: string,
    id: string
  ): Promise<{ message: string; success: boolean } | undefined> {
    const shouldProcess = partial || (!partial && !this.toolCalls.has(id))
    const isFinal = !partial

    let toolCall = this.toolCalls.get(id)
    if (!toolCall) {
      toolCall = {
        bindings: new Map([
          ['document', 'document'],
          ['root', 'document'],
        ]),
        operations: [],
        failed: false,
        operationResponse: '',
      }
      this.toolCalls.set(id, toolCall)
    }

    if (shouldProcess && !toolCall.failed) {
      await this.processOperations(toolCall, ctx, operations)
    }

    if (isFinal) {
      if (toolCall.failed) {
        // Rollback would happen via transaction manager
        return { message: toolCall.operationResponse, success: false }
      } else {
        // Commit operations
        return { message: this.createResponse(toolCall), success: true }
      }
    }

    return undefined
  }

  private async processOperations(
    toolCall: BatchDesignToolCall,
    ctx: ToolContext,
    operations: string
  ): Promise<void> {
    let currentOperation = ''

    try {
      const parsedOps = this.preprocessOperations(operations, toolCall.bindings)

      for (const op of parsedOps) {
        currentOperation = op.original

        if (op.callee === 'I') {
          await this.handleInsert(toolCall, ctx, op)
        } else if (op.callee === 'C') {
          await this.handleCopy(toolCall, ctx, op)
        } else if (op.callee === 'R') {
          await this.handleReplace(toolCall, ctx, op)
        } else if (op.callee === 'M') {
          await this.handleMove(toolCall, ctx, op)
        } else if (op.callee === 'D') {
          await this.handleDelete(toolCall, ctx, op)
        } else if (op.callee === 'U') {
          await this.handleUpdate(toolCall, ctx, op)
        }
      }
    } catch (err: any) {
      console.error('[batch-design] failed to execute operation:', currentOperation, err)
      toolCall.failed = true
      toolCall.operationResponse = this.createFailedResponse(currentOperation, err.toString())
    }
  }

  private async handleInsert(
    toolCall: BatchDesignToolCall,
    ctx: ToolContext,
    op: PreprocessedOperation
  ): Promise<void> {
    const parentId = this.parseParentParam(op.arguments[0], toolCall.bindings)
    const data = op.arguments[1]
    this.mapBindingsIntoPaths(data, toolCall.bindings)

    const docId = requireActiveDocId(ctx)
    const layerId = ctx.ids.layer() as LayerId

    // Extract frameId from parent or use active page's first frame
    const doc = ctx.editor.getDocument(docId)
    if (!doc) throw new Error('Document not found')

    const frameId = this.resolveFrameId(parentId, doc, ctx)

    const result = await this.commandBus.dispatch(
      {
        type: 'layer.create',
        payload: {
          docId,
          layerId,
          input: {
            frameId,
            type: data.type || 'rect',
            name: data.name || `Layer ${layerId}`,
            rect: data.rect || { x: 0, y: 0, w: 100, h: 100 },
            ...data,
          },
        },
      },
      ctx
    )

    if (!result.ok) {
      throw new Error(result.error.message)
    }

    if (op.variable) {
      toolCall.bindings.set(op.variable, layerId)
    }

    toolCall.operationResponse += `- Inserted layer \`${layerId}\`\n`
  }

  private async handleCopy(
    toolCall: BatchDesignToolCall,
    ctx: ToolContext,
    op: PreprocessedOperation
  ): Promise<void> {
    const toCopy = this.mapPathWithBindings(op.arguments[0], toolCall.bindings)
    const parentId = this.parseParentParam(op.arguments[1], toolCall.bindings)
    const fromNode = op.arguments[2]
    this.mapBindingsIntoPaths(fromNode, toolCall.bindings)

    const docId = requireActiveDocId(ctx)
    const doc = ctx.editor.getDocument(docId)
    if (!doc) throw new Error('Document not found')

    // Find source layer
    const sourceLayer = doc.layers[toCopy as LayerId]
    if (!sourceLayer) throw new Error(`Layer not found: ${toCopy}`)

    const newLayerId = ctx.ids.layer() as LayerId
    const frameId = this.resolveFrameId(parentId, doc, ctx)

    const result = await this.commandBus.dispatch(
      {
        type: 'layer.create',
        payload: {
          docId,
          layerId: newLayerId,
          input: {
            ...sourceLayer,
            frameId,
            id: newLayerId,
            name: fromNode.name || sourceLayer.name,
          },
        },
      },
      ctx
    )

    if (!result.ok) {
      throw new Error(result.error.message)
    }

    if (op.variable) {
      toolCall.bindings.set(op.variable, newLayerId)
    }

    toolCall.operationResponse += `- Copied layer \`${toCopy}\` to \`${newLayerId}\`\n`
  }

  private async handleReplace(
    toolCall: BatchDesignToolCall,
    ctx: ToolContext,
    op: PreprocessedOperation
  ): Promise<void> {
    const toReplace = this.mapPathWithBindings(op.arguments[0], toolCall.bindings)
    const data = op.arguments[1]
    this.mapBindingsIntoPaths(data, toolCall.bindings)

    const docId = requireActiveDocId(ctx)
    const layerId = toReplace as LayerId

    const allowed = ['name', 'rect', 'style', 'type'] as const
    const patch = this.pickPatch(data, allowed as any)

    const result = await this.commandBus.dispatch(
      {
        type: 'layer.update',
        payload: { docId, layerId, patch },
      },
      ctx
    )

    if (!result.ok) {
      throw new Error(result.error.message)
    }

    if (op.variable) {
      toolCall.bindings.set(op.variable, layerId)
    }

    toolCall.operationResponse += `- Replaced layer \`${toReplace}\`\n`
  }

  private async handleMove(
    toolCall: BatchDesignToolCall,
    ctx: ToolContext,
    op: PreprocessedOperation
  ): Promise<void> {
    const toMove = this.mapPathWithBindings(op.arguments[0], toolCall.bindings)
    const index = op.arguments[2] ?? undefined

    const docId = requireActiveDocId(ctx)
    const layerId = toMove as LayerId

    if (index !== undefined) {
      const result = await this.commandBus.dispatch(
        {
          type: 'layer.reorder',
          payload: { docId, layerId, toIndex: index },
        },
        ctx
      )

      if (!result.ok) {
        throw new Error(result.error.message)
      }
    }

    toolCall.operationResponse += `- Moved layer \`${layerId}\`\n`
  }

  private async handleDelete(
    toolCall: BatchDesignToolCall,
    ctx: ToolContext,
    op: PreprocessedOperation
  ): Promise<void> {
    const toDelete = this.mapPathWithBindings(op.arguments[0], toolCall.bindings)

    const docId = requireActiveDocId(ctx)
    const layerId = toDelete as LayerId

    const result = await this.commandBus.dispatch(
      {
        type: 'layer.delete',
        payload: { docId, layerId },
      },
      ctx
    )

    if (!result.ok) {
      throw new Error(result.error.message)
    }

    toolCall.operationResponse += `- Deleted layer \`${layerId}\`\n`
  }

  private async handleUpdate(
    toolCall: BatchDesignToolCall,
    ctx: ToolContext,
    op: PreprocessedOperation
  ): Promise<void> {
    const pathParam = this.mapPathWithBindings(op.arguments[0], toolCall.bindings)
    const data = op.arguments[1]
    this.mapBindingsIntoPaths(data, toolCall.bindings)

    const docId = requireActiveDocId(ctx)
    const layerId = pathParam as LayerId

    const allowed = ['name', 'rect', 'style', 'rotation'] as const
    const patch = this.pickPatch(data, allowed as any)

    const result = await this.commandBus.dispatch(
      {
        type: 'layer.update',
        payload: { docId, layerId, patch },
      },
      ctx
    )

    if (!result.ok) {
      throw new Error(result.error.message)
    }

    toolCall.operationResponse += `- Updated layer \`${layerId}\`\n`
  }

  private preprocessOperations(
    operations: string,
    bindings: Map<string, string | undefined>
  ): PreprocessedOperation[] {
    const preprocessedOperations: PreprocessedOperation[] = []
    const ast = acorn.parse(operations, { ecmaVersion: 2020 }) as any
    const ops: ParsedCall[] = ast.body.map((statement: any) => this.parseStatement(statement))

    for (const op of ops) {
      preprocessedOperations.push({
        original: JSON.stringify(op),
        ...op,
      })
    }

    return preprocessedOperations
  }

  private parseStatement(statement: any): ParsedCall {
    if (
      statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'AssignmentExpression'
    ) {
      const { left, right } = statement.expression
      return {
        callee: right.callee.name,
        variable: left.name,
        arguments: right.arguments.map((n: any) => this.astNodeToValue(n)),
      }
    }

    if (
      statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'CallExpression'
    ) {
      return {
        callee: statement.expression.callee.name,
        arguments: statement.expression.arguments.map((n: any) => this.astNodeToValue(n)),
      }
    }

    throw new Error('Unexpected statement type')
  }

  private astNodeToValue(node: any): any {
    switch (node.type) {
      case 'Literal':
        return node.value
      case 'Identifier':
        if (node.name === 'undefined') return undefined
        return `#${node.name}`
      case 'BinaryExpression':
        if (node.operator === '+') {
          return (
            (node.left.type === 'Identifier' ? `#${node.left.name}` : node.left.value) +
            (node.right.type === 'Identifier' ? `/#${node.right.name}` : node.right.value)
          )
        }
        return node
      case 'ObjectExpression':
        const obj: Record<string, any> = {}
        for (const prop of node.properties) {
          if (prop.type === 'Property') {
            const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
            obj[key] = this.astNodeToValue(prop.value)
          }
        }
        return obj
      case 'ArrayExpression':
        return node.elements.map((el: any) => (el ? this.astNodeToValue(el) : null))
      default:
        return node.name || `<${node.type}>`
    }
  }

  private parseParentParam(path: string, bindings: Map<string, string | undefined>): string | undefined {
    if (['document', 'root', '#document', '#root'].includes(path)) {
      return undefined
    }
    return this.mapPathWithBindings(path, bindings)
  }

  private mapPathWithBindings(path: string, bindings: Map<string, string | undefined>): string {
    return path
      .split('/')
      .map((c) => {
        if (c.startsWith('#')) {
          const name = c.slice(1)
          if (!bindings.has(name)) {
            throw new Error(`binding variable ${name} not found`)
          }
          return bindings.get(name)
        }
        return c
      })
      .join('/')
  }

  private mapBindingsIntoPaths(node: any, bindings: Map<string, string | undefined>): void {
    if (typeof node !== 'object' || node === null) return

    if (node.ref) {
      node.ref = this.mapPathWithBindings(node.ref, bindings)
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        this.mapBindingsIntoPaths(child, bindings)
      }
    }

    if (node.descendants) {
      for (const [path, overrides] of Object.entries(node.descendants)) {
        this.mapBindingsIntoPaths(overrides, bindings)
      }
    }
  }

  private resolveFrameId(
    parentId: string | undefined,
    doc: any,
    ctx: ToolContext
  ): FrameId {
    if (!parentId || parentId === 'document' || parentId === 'root') {
      // Use active page's first frame
      const activePageId = doc.activePageId
      if (!activePageId) throw new Error('No active page')
      const page = doc.pages[activePageId]
      if (!page || page.frameIds.length === 0) {
        throw new Error('No frames in active page')
      }
      return page.frameIds[0] as FrameId
    }

    // Check if parentId is a frame
    if (doc.frames[parentId as FrameId]) {
      return parentId as FrameId
    }

    // If it's a layer, get its frameId
    const layer = doc.layers[parentId as LayerId]
    if (layer) {
      return layer.frameId
    }

    throw new Error(`Cannot resolve frame for parent: ${parentId}`)
  }

  private pickPatch<T extends Record<string, any>>(patch: any, allowed: Array<keyof T>): Partial<T> {
    const out: any = {}
    for (const k of allowed) {
      if (patch && Object.prototype.hasOwnProperty.call(patch, k)) {
        out[k as string] = patch[k as string]
      }
    }
    return out
  }

  private createFailedResponse(currentOperation: string, errorMessage: string): string {
    return `## Failure during operation execution\n\nFailed to execute: \`${currentOperation}\`\n\nError: ${errorMessage}\n\nAll operations in this block have been rolled back.`
  }

  private createResponse(toolCall: BatchDesignToolCall): string {
    let response = '# Successfully executed all operations.\n'

    if (toolCall.operationResponse !== '') {
      response += `\n## Operation results:\n${toolCall.operationResponse}`
    }

    return response
  }
}

interface ParsedCall {
  callee: string
  variable?: string
  arguments: any[]
}

type OperationBindings = Map<string, string | undefined>
type PreprocessedOperation = { original: string } & ParsedCall

type BatchDesignToolCall = {
  bindings: OperationBindings
  operations: any[]
  failed: boolean
  operationResponse: string
}

function requireActiveDocId(ctx: ToolContext): DocumentId {
  if (!ctx.activeDocumentId) {
    throw new Error('No active document. User must select an active document context.')
  }
  return ctx.activeDocumentId
}
