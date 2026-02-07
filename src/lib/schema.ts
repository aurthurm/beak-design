/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * CanvasMCP Schema (v1)
 * - Normalized document graph
 * - Stable IDs
 * - Token binding via { tokenRef }
 *
 * This schema is intentionally renderer-agnostic (tldraw is a view/runtime).
 */

export const SCHEMA_VERSION = "1.0.0" as const;

/** Branded ID types */
export type Id<T extends string> = string & { __brand: T };

export type DocumentId = Id<"DocumentId">;
export type PageId = Id<"PageId">;
export type FrameId = Id<"FrameId">;
export type LayerId = Id<"LayerId">;
export type ComponentId = Id<"ComponentId">;
export type TokenId = Id<"TokenId">;
export type TransactionId = Id<"TransactionId">;

/** Utilities */
export type ISODateString = string;

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type PlatformTag = "mobile" | "tablet" | "desktop" | "web" | "custom";
export type LayerType = "rect" | "text" | "image" | "ellipse" | "line" | "path" | "group" | "componentInstance";

/** Attribution for provenance and debugging */
export type Actor =
  | { kind: "user"; userId?: string; displayName?: string }
  | { kind: "agent"; agentId?: string; agentName?: string; client?: string; sessionId?: string };

export type Provenance = {
  createdAt: ISODateString;
  createdBy: Actor;
  updatedAt?: ISODateString;
  updatedBy?: Actor;
  /** optional prompt/instruction identifiers */
  instructionId?: string;
};

/** Token references */
export type TokenRef = {
  tokenId: TokenId;
};

/** Token definitions */
export type ColorToken = {
  id: TokenId;
  kind: "color";
  name: string; // e.g. "brand.primary"
  value: { format: "hex"; hex: string }; // keep simple for v1
  meta?: Record<string, any>;
};

export type TypographyToken = {
  id: TokenId;
  kind: "typography";
  name: string; // e.g. "text.h1"
  value: {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    lineHeight: number;
    letterSpacing?: number;
  };
  meta?: Record<string, any>;
};

export type SpacingToken = {
  id: TokenId;
  kind: "spacing";
  name: string; // e.g. "space.4"
  value: { px: number };
  meta?: Record<string, any>;
};

export type Token = ColorToken | TypographyToken | SpacingToken;

/** Common layer flags */
export type LayerFlags = {
  locked?: boolean;
  hidden?: boolean;
};

/** Style values can be literal or token-bound */
export type ColorValue = { literal: { format: "hex"; hex: string } } | { tokenRef: TokenRef };
export type TypographyValue =
  | { literal: TypographyToken["value"] }
  | { tokenRef: TokenRef };

export type StrokeStyle = {
  width: number;
  color: ColorValue;
  /** Line cap style: 'butt' (default), 'round', or 'square' */
  lineCap?: 'butt' | 'round' | 'square';
  /** Line join style: 'miter' (default), 'round', or 'bevel' */
  lineJoin?: 'miter' | 'round' | 'bevel';
  /** Miter limit for miter joins (default: 10) */
  miterLimit?: number;
  /** Dash pattern array (e.g., [5, 5] for dashed, [2, 2] for dotted). Empty array means solid line. */
  dash?: number[];
};

export type FillStyle =
  | { kind: "none" }
  | { kind: "solid"; color: ColorValue };

export type CommonStyle = {
  opacity?: number; // 0..1
  fill?: FillStyle;
  stroke?: StrokeStyle;
  radius?: number; // rect radius
};

/** Layout hints (lightweight v1) */
export type Constraints = {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
  centerX?: boolean;
  centerY?: boolean;
};

export type LayoutHints = {
  constraints?: Constraints;
  /** If you add stacks/grids later, expand here */
  grid?: {
    columns: number;
    gutter: number;
    margin: number;
  };
};

/** Base layer */
export type LayerBase = {
  id: LayerId;
  type: LayerType;
  name: string;
  parentId: FrameId | LayerId | null; // frame or group
  frameId: FrameId; // owning frame for export scoping
  rect: Rect;
  rotation?: number; // degrees
  style?: CommonStyle;
  layout?: LayoutHints;
  flags?: LayerFlags;
  children?: LayerId[]; // for group layers
  provenance: Provenance;
};

/** Specific layer payloads */
export type RectLayer = LayerBase & {
  type: "rect";
};

export type EllipseLayer = LayerBase & {
  type: "ellipse";
};

export type LineLayer = LayerBase & {
  type: "line";
  points: Point[]; // polyline
};

export type PathCommand = 
  | { type: "M"; point: Point } // MoveTo
  | { type: "L"; point: Point } // LineTo
  | { type: "C"; point: Point; cp1: Point; cp2: Point } // Cubic Bezier curve
  | { type: "Q"; point: Point; cp: Point } // Quadratic Bezier curve
  | { type: "Z" }; // ClosePath

export type PathLayer = LayerBase & {
  type: "path";
  commands: PathCommand[]; // SVG-like path commands
  closed?: boolean; // Whether the path is closed
};

export type TextLayer = LayerBase & {
  type: "text";
  text: string;
  typography?: TypographyValue;
  color?: ColorValue;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
};

export type ImageLayer = LayerBase & {
  type: "image";
  assetId: string; // points to assets table
  /** optional crop rect inside the image */
  crop?: { x: number; y: number; w: number; h: number };
};

export type GroupLayer = LayerBase & {
  type: "group";
  children: LayerId[];
};

export type ComponentInstanceLayer = LayerBase & {
  type: "componentInstance";
  componentId: ComponentId;
  overrides?: {
    text?: Record<LayerId, string>; // override text by child layer id
    fillColor?: Record<LayerId, ColorValue>; // override fill by layer id
  };
};

export type Layer =
  | RectLayer
  | EllipseLayer
  | LineLayer
  | PathLayer
  | TextLayer
  | ImageLayer
  | GroupLayer
  | ComponentInstanceLayer;

/** Frame (artboard) */
export type Frame = {
  id: FrameId;
  pageId: PageId;
  name: string;
  platform: PlatformTag;
  rect: Rect; // frame bounds on canvas
  background?: FillStyle; // usually solid
  childLayerIds: LayerId[]; // top-level children
  flags?: LayerFlags; // same flags as layers (locked, hidden)
  provenance: Provenance;
};

/** Component definition */
export type Component = {
  id: ComponentId;
  name: string;
  /** A component is defined by a root group snapshot (layer subgraph).
   *  For v1: store as a list of layerIds that belong to the component.
   *  Later: store a dedicated component graph.
   */
  rootLayerId: LayerId;
  layerIds: LayerId[];
  provenance: Provenance;
};

/** Page */
export type Page = {
  id: PageId;
  documentId: DocumentId;
  name: string;
  frameIds: FrameId[];
  provenance: Provenance;
};

/** Asset */
export type Asset = {
  id: string;
  kind: "image";
  name?: string;
  mimeType: string;
  /** local file path or base64 or blob key - depends on your storage */
  uri: string;
  provenance: Provenance;
};

/** Document */
export type Document = {
  id: DocumentId;
  schemaVersion: typeof SCHEMA_VERSION;
  name: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;

  activePageId: PageId | null;

  pages: Record<PageId, Page>;
  frames: Record<FrameId, Frame>;
  layers: Record<LayerId, Layer>;
  components: Record<ComponentId, Component>;
  tokens: Record<TokenId, Token>;
  assets: Record<string, Asset>;

  meta?: Record<string, any>;
};

/** Selection snapshot (useful for MCP resource) */
export type SelectionState = {
  pageId: PageId | null;
  selectedIds: Array<FrameId | LayerId>;
  bounds?: Rect;
};

/** Minimal “patch” semantics: only allow partial updates of whitelisted fields */
export type Patch<T> = Partial<T>;

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
