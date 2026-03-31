import type { Command, CommandBus, CommandResult, ToolContext, DocumentId, PageId, FrameId, LayerId } from '../../tool-core/src'
import type { Document } from '../../schema/src'
import { applyDocumentMutation } from './document-mutations'

/**
 * Command Bus Implementation
 * Executes commands and mutates document state
 */
export class CanvasCommandBus implements CommandBus {
  async dispatch(cmd: Command, ctx: ToolContext): Promise<CommandResult> {
    try {
      const docId = this.getDocumentId(cmd)
      if (!docId) {
        return {
          ok: false,
          error: {
            code: 'MISSING_DOC_ID',
            message: 'Command requires document ID',
          },
        }
      }

      let document = ctx.editor.getDocument(docId)
      if (!document) {
        document = await ctx.storage.loadDocument(docId)
        if (document) {
          ctx.editor.setDocument(document)
        } else {
          return {
            ok: false,
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: `Document ${docId} not found`,
            },
          }
        }
      }

      const result = await this.executeCommand(cmd, document, ctx)

      if (result.ok) {
        ctx.editor.setDocument(result.document)
        await ctx.storage.saveDocument(result.document)
      }

      return result
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'COMMAND_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      }
    }
  }

  private async executeCommand(
    cmd: Command,
    document: Document,
    ctx: ToolContext
  ): Promise<CommandResult & { document: Document }> {
    const now = ctx.nowISO()
    let updatedDocument = { ...document }

    switch (cmd.type) {
      case 'doc.create': {
        const newDoc = ctx.storage.createEmptyDocument({
          name: cmd.payload.name,
          docId: cmd.payload.docId,
          now,
        })
        return { ok: true, document: newDoc }
      }

      case 'doc.open': {
        const doc = await ctx.storage.loadDocument(cmd.payload.docId)
        if (!doc) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Document not found' },
            document,
          }
        }
        return { ok: true, document: doc }
      }

      case 'doc.save': {
        await ctx.storage.saveDocument(document)
        return { ok: true, document }
      }

      case 'page.create': {
        const pageId = cmd.payload.pageId
        updatedDocument = {
          ...updatedDocument,
          updatedAt: now,
          pages: {
            ...updatedDocument.pages,
            [pageId]: {
              id: pageId,
              documentId: document.id,
              name: cmd.payload.name,
              frameIds: [],
              provenance: {
                createdAt: now,
                createdBy: ctx.actor,
              },
            },
          },
        }
        return { ok: true, document: updatedDocument }
      }

      case 'page.delete': {
        const { [cmd.payload.pageId]: deleted, ...remainingPages } = updatedDocument.pages
        const page = deleted
        if (page) {
          const frameIdsToDelete = page.frameIds
          const layerIdsToDelete = new Set<LayerId>()

          for (const frameId of frameIdsToDelete) {
            const frame = updatedDocument.frames[frameId]
            if (frame) {
              frame.childLayerIds.forEach((lid) => layerIdsToDelete.add(lid))
            }
          }

          const remainingFrames = { ...updatedDocument.frames }
          frameIdsToDelete.forEach((fid) => delete remainingFrames[fid])

          const remainingLayers = { ...updatedDocument.layers }
          layerIdsToDelete.forEach((lid) => delete remainingLayers[lid])

          updatedDocument = {
            ...updatedDocument,
            updatedAt: now,
            pages: remainingPages,
            frames: remainingFrames,
            layers: remainingLayers,
            activePageId:
              updatedDocument.activePageId === cmd.payload.pageId
                ? (Object.keys(remainingPages)[0] as PageId | null)
                : updatedDocument.activePageId,
          }
        }
        return { ok: true, document: updatedDocument }
      }

      case 'page.rename': {
        const page = updatedDocument.pages[cmd.payload.pageId]
        if (!page) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Page not found' },
            document,
          }
        }
        updatedDocument = {
          ...updatedDocument,
          updatedAt: now,
          pages: {
            ...updatedDocument.pages,
            [cmd.payload.pageId]: {
              ...page,
              name: cmd.payload.name,
              provenance: {
                ...page.provenance,
                updatedAt: now,
                updatedBy: ctx.actor,
              },
            },
          },
        }
        return { ok: true, document: updatedDocument }
      }

      case 'page.setActive': {
        updatedDocument = {
          ...updatedDocument,
          updatedAt: now,
          activePageId: cmd.payload.pageId,
        }
        return { ok: true, document: updatedDocument }
      }

      case 'frame.create': {
        const frameId = cmd.payload.frameId
        const page = updatedDocument.pages[cmd.payload.input.pageId]
        if (!page) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Page not found' },
            document,
          }
        }
        updatedDocument = {
          ...updatedDocument,
          updatedAt: now,
          frames: {
            ...updatedDocument.frames,
            [frameId]: {
              id: frameId,
              pageId: cmd.payload.input.pageId,
              name: cmd.payload.input.name,
              platform: cmd.payload.input.platform,
              rect: cmd.payload.input.rect,
              childLayerIds: [],
              provenance: {
                createdAt: now,
                createdBy: ctx.actor,
              },
            },
          },
          pages: {
            ...updatedDocument.pages,
            [cmd.payload.input.pageId]: {
              ...page,
              frameIds: [...page.frameIds, frameId],
            },
          },
        }
        return { ok: true, document: updatedDocument }
      }

      case 'frame.update': {
        const frame = updatedDocument.frames[cmd.payload.frameId]
        if (!frame) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Frame not found' },
            document,
          }
        }
        updatedDocument = {
          ...updatedDocument,
          updatedAt: now,
          frames: {
            ...updatedDocument.frames,
            [cmd.payload.frameId]: {
              ...frame,
              ...cmd.payload.patch,
            },
          },
        }
        return { ok: true, document: updatedDocument }
      }

      case 'frame.delete': {
        const frame = updatedDocument.frames[cmd.payload.frameId]
        if (!frame) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Frame not found' },
            document,
          }
        }
        const page = updatedDocument.pages[frame.pageId]
        const { [cmd.payload.frameId]: deleted, ...remainingFrames } = updatedDocument.frames

        const layerIdsToDelete = frame.childLayerIds
        const remainingLayers = { ...updatedDocument.layers }
        layerIdsToDelete.forEach((lid) => delete remainingLayers[lid])

        updatedDocument = {
          ...updatedDocument,
          updatedAt: now,
          frames: remainingFrames,
          layers: remainingLayers,
          pages: page
            ? {
                ...updatedDocument.pages,
                [frame.pageId]: {
                  ...page,
                  frameIds: page.frameIds.filter((fid) => fid !== cmd.payload.frameId),
                },
              }
            : updatedDocument.pages,
        }
        return { ok: true, document: updatedDocument }
      }

      case 'layer.create': {
        const layerId = cmd.payload.layerId
        const frame = updatedDocument.frames[cmd.payload.input.frameId]
        if (!frame) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Frame not found' },
            document,
          }
        }
        updatedDocument = {
          ...updatedDocument,
          updatedAt: now,
          layers: {
            ...updatedDocument.layers,
            [layerId]: {
              ...cmd.payload.input,
              id: layerId,
              provenance: {
                createdAt: now,
                createdBy: ctx.actor,
              },
            },
          },
          frames: {
            ...updatedDocument.frames,
            [cmd.payload.input.frameId]: {
              ...frame,
              childLayerIds: [...frame.childLayerIds, layerId],
            },
          },
        }
        return { ok: true, document: updatedDocument }
      }

      case 'layer.update': {
        const layer = updatedDocument.layers[cmd.payload.layerId]
        if (!layer) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Layer not found' },
            document,
          }
        }
        updatedDocument = {
          ...updatedDocument,
          updatedAt: now,
          layers: {
            ...updatedDocument.layers,
            [cmd.payload.layerId]: {
              ...layer,
              ...cmd.payload.patch,
            },
          },
        }
        return { ok: true, document: updatedDocument }
      }

      case 'layer.delete': {
        const layer = updatedDocument.layers[cmd.payload.layerId]
        if (!layer) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Layer not found' },
            document,
          }
        }
        const frame = updatedDocument.frames[layer.frameId]
        const { [cmd.payload.layerId]: deleted, ...remainingLayers } = updatedDocument.layers

        updatedDocument = {
          ...updatedDocument,
          updatedAt: now,
          layers: remainingLayers,
          frames: frame
            ? {
                ...updatedDocument.frames,
                [layer.frameId]: {
                  ...frame,
                  childLayerIds: frame.childLayerIds.filter((lid) => lid !== cmd.payload.layerId),
                },
              }
            : updatedDocument.frames,
        }
        return { ok: true, document: updatedDocument }
      }

      case 'layer.group':
      case 'layer.ungroup':
      case 'layer.reorder':
      case 'tokens.upsert':
        return applyDocumentMutation(cmd, updatedDocument, { actor: ctx.actor, now })

      case 'selection.set': {
        ctx.editor.setSelection(cmd.payload.selection)
        return { ok: true, document }
      }

      default: {
        return {
          ok: false,
          error: {
            code: 'UNKNOWN_COMMAND',
            message: `Unknown command type: ${(cmd as any).type}`,
          },
          document,
        }
      }
    }
  }

  private getDocumentId(cmd: Command): DocumentId | null {
    if ('payload' in cmd && cmd.payload && typeof cmd.payload === 'object') {
      return (cmd.payload as any).docId ?? null
    }
    return null
  }
}
