import type { Actor, Document } from '../../schema/src'
import type { Command, CommandResult } from '../../tool-core/src'

type MutationCommand = Extract<
  Command,
  { type: 'layer.group' } | { type: 'layer.ungroup' } | { type: 'layer.reorder' } | { type: 'tokens.upsert' }
>

type MutationResult = CommandResult & { document: Document }

export function applyDocumentMutation(
  cmd: MutationCommand,
  document: Document,
  options: {
    actor: Actor
    now: string
  }
): MutationResult {
  const { actor, now } = options

  switch (cmd.type) {
    case 'layer.group': {
      const groupId = cmd.payload.groupId
      const frame = document.frames[document.layers[cmd.payload.layerIds[0]]?.frameId]
      if (!frame) {
        return {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Frame not found' },
          document,
        }
      }
      return {
        ok: true,
        document: {
          ...document,
          updatedAt: now,
          layers: {
            ...document.layers,
            [groupId]: {
              id: groupId,
              type: 'group',
              name: cmd.payload.name,
              parentId: null,
              frameId: frame.id,
              rect: { x: 0, y: 0, w: 100, h: 100 },
              children: cmd.payload.layerIds,
              provenance: {
                createdAt: now,
                createdBy: actor,
              },
            },
          },
        },
      }
    }

    case 'layer.ungroup': {
      const group = document.layers[cmd.payload.groupId]
      if (!group || group.type !== 'group') {
        return {
          ok: false,
          error: { code: 'INVALID', message: 'Layer is not a group' },
          document,
        }
      }
      const { [cmd.payload.groupId]: _deleted, ...remainingLayers } = document.layers
      return {
        ok: true,
        document: {
          ...document,
          updatedAt: now,
          layers: remainingLayers,
        },
      }
    }

    case 'layer.reorder': {
      const layer = document.layers[cmd.payload.layerId]
      if (!layer) {
        return {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Layer not found' },
          document,
        }
      }
      const frame = document.frames[layer.frameId]
      if (!frame) {
        return {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Frame not found' },
          document,
        }
      }
      const currentIndex = frame.childLayerIds.indexOf(cmd.payload.layerId)
      if (currentIndex === -1) {
        return {
          ok: false,
          error: { code: 'INVALID', message: 'Layer not in frame' },
          document,
        }
      }

      const newOrder = [...frame.childLayerIds]
      newOrder.splice(currentIndex, 1)
      newOrder.splice(cmd.payload.toIndex, 0, cmd.payload.layerId)

      return {
        ok: true,
        document: {
          ...document,
          updatedAt: now,
          frames: {
            ...document.frames,
            [layer.frameId]: {
              ...frame,
              childLayerIds: newOrder,
            },
          },
        },
      }
    }

    case 'tokens.upsert': {
      const updatedTokens = { ...document.tokens }
      for (const token of cmd.payload.tokens) {
        updatedTokens[token.id] = token
      }
      return {
        ok: true,
        document: {
          ...document,
          updatedAt: now,
          tokens: updatedTokens,
        },
      }
    }
  }
}
