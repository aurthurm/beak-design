export * from '../../packages/schema/src'

/** Common create payloads */
export type CreateFrameInput = {
  pageId: PageId;
  name: string;
  platform: PlatformTag;
  rect: Rect;
  background?: FillStyle;
};

export type CreateLayerInput = {
  frameId: FrameId;
  parentId: FrameId | LayerId | null;
  type: Exclude<LayerType, "group" | "componentInstance"> | "group";
  name: string;
  rect: Rect;
  rotation?: number;
  style?: CommonStyle;
  layout?: LayoutHints;
  flags?: LayerFlags;
  // type-specific
  text?: string;
  typography?: TypographyValue;
  color?: ColorValue;
  align?: TextLayer["align"];
  verticalAlign?: TextLayer["verticalAlign"];
  assetId?: string;
  crop?: ImageLayer["crop"];
  points?: LineLayer["points"];
  commands?: PathLayer["commands"];
  closed?: boolean;
  children?: LayerId[];
};

export type CreateComponentInput = {
  name: string;
  rootLayerId: LayerId;
  layerIds: LayerId[];
};

export type InstantiateComponentInput = {
  frameId: FrameId;
  parentId: FrameId | LayerId | null;
  componentId: ComponentId;
  name: string;
  rect: Rect;
};

export type UpsertTokenInput = Token;

/** Export request */
export type ExportFramePngInput = {
  frameId: FrameId;
  scale: 1 | 2 | 3;
};

/** Helper: runtime ID generator (plug your own) */
export type IdFactory = {
  doc(): DocumentId;
  page(): PageId;
  frame(): FrameId;
  layer(): LayerId;
  component(): ComponentId;
  token(): TokenId;
  tx(): TransactionId;
};
