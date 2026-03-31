/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * CanvasMCP Schema (v1)
 * - Normalized document graph
 * - Stable IDs
 * - Token binding via { tokenRef }
 *
 * This schema is intentionally renderer-agnostic.
 */

export const SCHEMA_VERSION = '1.0.0' as const

export type Id<T extends string> = string & { __brand: T }

export type DocumentId = Id<'DocumentId'>
export type PageId = Id<'PageId'>
export type FrameId = Id<'FrameId'>
export type LayerId = Id<'LayerId'>
export type ComponentId = Id<'ComponentId'>
export type TokenId = Id<'TokenId'>
export type TransactionId = Id<'TransactionId'>

export type ISODateString = string

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }

export type PlatformTag = 'mobile' | 'tablet' | 'desktop' | 'web' | 'custom'
export type LayerType =
  | 'rect'
  | 'text'
  | 'image'
  | 'ellipse'
  | 'line'
  | 'path'
  | 'group'
  | 'componentInstance'

export type Actor =
  | { kind: 'user'; userId?: string; displayName?: string }
  | { kind: 'agent'; agentId?: string; agentName?: string; client?: string; sessionId?: string }

export type Provenance = {
  createdAt: ISODateString
  createdBy: Actor
  updatedAt?: ISODateString
  updatedBy?: Actor
  instructionId?: string
}

export type TokenRef = {
  tokenId: TokenId
}

export type ColorToken = {
  id: TokenId
  kind: 'color'
  name: string
  value: { format: 'hex'; hex: string }
  meta?: Record<string, any>
}

export type TypographyToken = {
  id: TokenId
  kind: 'typography'
  name: string
  value: {
    fontFamily: string
    fontWeight: number
    fontSize: number
    lineHeight: number
    letterSpacing?: number
  }
  meta?: Record<string, any>
}

export type SpacingToken = {
  id: TokenId
  kind: 'spacing'
  name: string
  value: { px: number }
  meta?: Record<string, any>
}

export type Token = ColorToken | TypographyToken | SpacingToken

export type LayerFlags = {
  locked?: boolean
  hidden?: boolean
}

export type ColorValue = { literal: { format: 'hex'; hex: string } } | { tokenRef: TokenRef }
export type TypographyValue = { literal: TypographyToken['value'] } | { tokenRef: TokenRef }

export type StrokeStyle = {
  width: number
  color: ColorValue
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'miter' | 'round' | 'bevel'
  miterLimit?: number
  dash?: number[]
}

export type FillStyle =
  | { kind: 'none' }
  | { kind: 'solid'; color: ColorValue }

export type CommonStyle = {
  opacity?: number
  fill?: FillStyle
  stroke?: StrokeStyle
  radius?: number
}

export type Constraints = {
  left?: boolean
  right?: boolean
  top?: boolean
  bottom?: boolean
  centerX?: boolean
  centerY?: boolean
}

export type LayoutHints = {
  constraints?: Constraints
  grid?: {
    columns: number
    gutter: number
    margin: number
  }
}

export type LayerBase = {
  id: LayerId
  type: LayerType
  name: string
  parentId: FrameId | LayerId | null
  frameId: FrameId
  rect: Rect
  rotation?: number
  style?: CommonStyle
  layout?: LayoutHints
  flags?: LayerFlags
  children?: LayerId[]
  provenance: Provenance
}

export type RectLayer = LayerBase & {
  type: 'rect'
}

export type EllipseLayer = LayerBase & {
  type: 'ellipse'
}

export type LineLayer = LayerBase & {
  type: 'line'
  points: Point[]
}

export type PathCommand =
  | { type: 'M'; point: Point }
  | { type: 'L'; point: Point }
  | { type: 'C'; point: Point; cp1: Point; cp2: Point }
  | { type: 'Q'; point: Point; cp: Point }
  | { type: 'Z' }

export type PathLayer = LayerBase & {
  type: 'path'
  commands: PathCommand[]
  closed?: boolean
}

export type TextLayer = LayerBase & {
  type: 'text'
  text: string
  typography?: TypographyValue
  color?: ColorValue
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
}

export type ImageLayer = LayerBase & {
  type: 'image'
  assetId: string
  crop?: { x: number; y: number; w: number; h: number }
}

export type GroupLayer = LayerBase & {
  type: 'group'
  children: LayerId[]
}

export type ComponentInstanceLayer = LayerBase & {
  type: 'componentInstance'
  componentId: ComponentId
  overrides?: {
    text?: Record<LayerId, string>
    fillColor?: Record<LayerId, ColorValue>
  }
}

export type Layer =
  | RectLayer
  | EllipseLayer
  | LineLayer
  | PathLayer
  | TextLayer
  | ImageLayer
  | GroupLayer
  | ComponentInstanceLayer

export type Frame = {
  id: FrameId
  pageId: PageId
  name: string
  platform: PlatformTag
  rect: Rect
  background?: FillStyle
  childLayerIds: LayerId[]
  flags?: LayerFlags
  provenance: Provenance
}

export type Component = {
  id: ComponentId
  name: string
  rootLayerId: LayerId
  layerIds: LayerId[]
  provenance: Provenance
}

export type Page = {
  id: PageId
  documentId: DocumentId
  name: string
  frameIds: FrameId[]
  provenance: Provenance
}

export type Asset = {
  id: string
  kind: 'image'
  name?: string
  mimeType: string
  uri: string
  provenance: Provenance
}

export type Document = {
  id: DocumentId
  schemaVersion: typeof SCHEMA_VERSION
  name: string
  createdAt: ISODateString
  updatedAt: ISODateString
  activePageId: PageId | null
  pages: Record<PageId, Page>
  frames: Record<FrameId, Frame>
  layers: Record<LayerId, Layer>
  components: Record<ComponentId, Component>
  tokens: Record<TokenId, Token>
  assets: Record<string, Asset>
  meta?: Record<string, any>
}

export type SelectionState = {
  pageId: PageId | null
  selectedIds: Array<FrameId | LayerId>
  bounds?: Rect
}

export type Patch<T> = Partial<T>

export type CreateFrameInput = {
  pageId: PageId
  name: string
  platform: PlatformTag
  rect: Rect
  background?: FillStyle
}

export type CreateLayerInput = {
  frameId: FrameId
  parentId: FrameId | LayerId | null
  type: Exclude<LayerType, 'group' | 'componentInstance'> | 'group'
  name: string
  rect: Rect
  rotation?: number
  style?: CommonStyle
  layout?: LayoutHints
  flags?: LayerFlags
  text?: string
  typography?: TypographyValue
  color?: ColorValue
  align?: TextLayer['align']
  verticalAlign?: TextLayer['verticalAlign']
  assetId?: string
  crop?: ImageLayer['crop']
  points?: LineLayer['points']
  commands?: PathLayer['commands']
  closed?: boolean
  children?: LayerId[]
}

export type CreateComponentInput = {
  name: string
  rootLayerId: LayerId
  layerIds: LayerId[]
}

export type InstantiateComponentInput = {
  frameId: FrameId
  parentId: FrameId | LayerId | null
  componentId: ComponentId
  name: string
  rect: Rect
}

export type UpsertTokenInput = Token

export type ExportFramePngInput = {
  frameId: FrameId
  scale: 1 | 2 | 3
}

export type IdFactory = {
  doc(): DocumentId
  page(): PageId
  frame(): FrameId
  layer(): LayerId
  component(): ComponentId
  token(): TokenId
  tx(): TransactionId
}

export { generateId, idGenerator } from './id-generator'
