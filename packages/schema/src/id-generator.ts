import { nanoid } from 'nanoid'

import type {
  ComponentId,
  DocumentId,
  FrameId,
  LayerId,
  PageId,
  TokenId,
  TransactionId,
} from './index'

export const idGenerator = {
  doc(): DocumentId {
    return nanoid() as DocumentId
  },
  page(): PageId {
    return nanoid() as PageId
  },
  frame(): FrameId {
    return nanoid() as FrameId
  },
  layer(): LayerId {
    return nanoid() as LayerId
  },
  component(): ComponentId {
    return nanoid() as ComponentId
  },
  token(): TokenId {
    return nanoid() as TokenId
  },
  tx(): TransactionId {
    return nanoid() as TransactionId
  },
}

export function generateId(_prefix: string): string {
  return nanoid()
}
