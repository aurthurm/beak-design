import type * as Schema from "@ha/schema";
import type { Canvas } from "@highagency/pencil-skia";
import { toast } from "sonner";
import { convertFontWeightToSkiaVariation } from "../../skia";
import type { SkiaRenderer } from "../../skia-renderer";
import { Bounds, type ReadOnlyBounds } from "../../utils/bounds";
import type { BaseProps, Component } from "../components/component";
import { Container } from "../components/container";
import { Shape } from "../components/shape";
import { Text } from "../components/text";
import { AlignItems, Axis, JustifyContent, LayoutMode } from "../layout";
import type { NodeProperties } from "../scene-graph";
import { SceneNode } from "../scene-node";
import { serializeCommon, serializeSize, serializeValue } from "../serializer";

type Theme = {
  headertext: string;
  headerBackground: string;
  background: string;
  outlineColor: string;
  textColor: string;
};

const Themes: Record<string, Theme> = {
  note: {
    headertext: "Note",
    headerBackground: "#FFF1D6",
    background: "#FFF7E5",
    outlineColor: "#8B6311",
    textColor: "#664500",
  },
  context: {
    headertext: "Context",
    headerBackground: "#FFFFFF",
    background: "#F0F0F0",
    outlineColor: "#767676",
    textColor: "#2C2C2C",
  },
  prompt: {
    headertext: "Prompt",
    headerBackground: "#C3E8FF",
    background: "#E8F6FF",
    outlineColor: "#009DFF",
    textColor: "#006CAF",
  },
};

export class StickyNode extends SceneNode {
  private isTextHidden: boolean = false;

  private _view: Container | null = null;
  private viewDirty: boolean = true;

  private textLayerRef: { current: Text | null } = { current: null };

  private submittingPromptTimeout: ReturnType<typeof setTimeout> | null = null;

  private getView(): Container {
    if (!this.viewDirty && this._view) {
      return this._view;
    }

    this.textLayerRef.current = null;
    if (this._view) {
      this._view.destroy();
      this._view = null;
    }

    if (!this.manager) {
      throw new Error("StickyNode: No manager available");
    }

    const theme = Themes[this.type];
    if (!theme) {
      throw new Error(`StickyNode: Unknown note type: ${this.type}`);
    }

    const { models, defaultModel } = this.manager.getAvailableModels();

    const model =
      models.find((m) => m.id === this.properties.resolved.modelName) ||
      defaultModel;

    const renderer = this.manager.skiaRenderer;

    const font = "JetBrains Mono";

    const runDisabled =
      !model ||
      !this.properties.resolved.textContent ||
      this.submittingPromptTimeout != null;

    this._view = new Container({
      width: Math.max(250, this.properties.resolved.width),
      height: "fit",

      backgroundColor: theme.background,
      outlineColor: theme.outlineColor,
      cornerRadius: 8,
      clip: true,
      outlineWidth: 1,
      children: [
        new Container({
          width: "fill",
          height: 45,
          padding: [12, 12, 12, 12],
          layout: LayoutMode.Horizontal,
          alignItems: AlignItems.Center,

          backgroundColor: theme.headerBackground,
          outlineColor: theme.outlineColor,
          outlineDash: [4, 4],
          outlineWidth: 1,
          children: [
            new Container({
              layout: LayoutMode.Horizontal,
              alignItems: AlignItems.Center,
              childSpacing: 2,

              cursor: "pointer",
              onClick: () => {
                const manager = this.manager;
                if (manager?.input) {
                  manager.eventEmitter.emit("showSelectUI", {
                    x: manager.input.mouse.window.x,
                    y: manager.input.mouse.window.y,

                    options: [
                      {
                        label: "Note",
                        value: "note",
                      },
                      {
                        label: "Context",
                        value: "context",
                      },
                      {
                        label: "Prompt",
                        value: "prompt",
                      },
                    ],

                    currentValue: this.type,
                    onSelect: (value: string) => {
                      this.type = value as "note" | "context" | "prompt";
                      this.invalidateView();
                    },
                  });
                }
              },

              children: [
                new Text(renderer, {
                  fontSize: 14,
                  fontFamily: font,
                  fontWeight: "500",
                  content: theme.headertext,
                  color: theme.textColor,
                  lineHeight: 21,
                }),

                new Shape({
                  width: 16,
                  height: 16,
                  outlineColor: theme.textColor,
                  outlineWidth: 1,

                  pathBounds: Bounds.MakeXYWH(0, 0, 16, 16),
                  path: "M4 7 8 11 12 7",
                }),
              ],
            }),
          ],
        }),

        new Container({
          width: "fill",
          padding: [12, 12, 12, 12],

          children: [
            new Text(renderer, {
              ref: this.textLayerRef,
              minHeight: this.type === "prompt" ? 116 : 150,
              width: "fill",
              textGrowth: "fixed-width",
              fontSize: 14,
              lineHeight: 21,
              fontFamily: font,
              fontWeight: "normal",
              content: this.properties.resolved.textContent || "",
              color: theme.textColor,
              visible: !this.isTextHidden,
            }),

            this.type === "prompt"
              ? new Container({
                  width: "fill",
                  padding: [8, 0, 0, 0],
                  layout: LayoutMode.Horizontal,
                  alignItems: AlignItems.Center,
                  childSpacing: 8,

                  children: [
                    // spacer
                    new Container({
                      width: "fill",
                      height: 0,
                    }),

                    models.length > 0
                      ? new Container({
                          layout: LayoutMode.Horizontal,
                          alignItems: AlignItems.Center,
                          childSpacing: 4,
                          padding: [4, 0, 4, 0],
                          cursor: "pointer",
                          onClick: () => {
                            const manager = this.manager;
                            if (manager?.input) {
                              manager.eventEmitter.emit("showSelectUI", {
                                x: manager.input.mouse.window.x,
                                y: manager.input.mouse.window.y,

                                options: models.map((model) => ({
                                  label: model.label,
                                  value: model.id,
                                })),

                                currentValue:
                                  this.properties.resolved.modelName ?? null,
                                onSelect: (value: string) => {
                                  const block =
                                    manager.scenegraph.beginUpdate();

                                  block.update(this, {
                                    modelName: value,
                                  });

                                  manager.scenegraph.commitBlock(block, {
                                    undo: true,
                                  });
                                },
                              });
                            }
                          },

                          children: [
                            new Text(renderer, {
                              color: theme.textColor,
                              lineHeight: 18,
                              fontSize: 12,
                              fontFamily: font,
                              fontWeight: "500",
                              content:
                                model?.label ??
                                this.properties.resolved.modelName ??
                                "Select Model",
                            }),

                            new Shape({
                              width: 12,
                              height: 12,
                              outlineColor: theme.textColor,
                              outlineWidth: 1,
                              pathBounds: Bounds.MakeXYWH(0, 0, 12, 12),
                              path: "M3 5 6 8 9 5",
                            }),
                          ],
                        })
                      : undefined,

                    models.length === 0
                      ? new Container({
                          cornerRadius: 6,
                          backgroundColor: theme.textColor,

                          layout: LayoutMode.Horizontal,
                          childSpacing: 6,
                          justifyContent: JustifyContent.Center,
                          alignItems: AlignItems.Center,
                          padding: [4, 12, 4, 10],
                          opacity: !this.properties.resolved.textContent
                            ? 0.5
                            : 1,

                          cursor: !this.properties.resolved.textContent
                            ? undefined
                            : "pointer",
                          onClick: () => {
                            const text = this.properties.resolved.textContent;
                            if (!text) {
                              return;
                            }

                            navigator.clipboard.writeText(text);
                            toast.info("Prompt copied to clipboard");
                          },
                          children: [
                            new Text(renderer, {
                              lineHeight: 18,
                              fontSize: 12,
                              fontFamily: font,
                              fontWeight: "500",
                              content: "Copy",
                              color: "#FFFFFF",
                            }),
                          ],
                        })
                      : new Container({
                          cornerRadius: 6,
                          backgroundColor: theme.textColor,

                          layout: LayoutMode.Horizontal,
                          childSpacing: 6,
                          justifyContent: JustifyContent.Center,
                          alignItems: AlignItems.Center,
                          padding: [4, 12, 4, 10],
                          opacity: runDisabled ? 0.5 : 1,

                          cursor: runDisabled ? undefined : "pointer",
                          onClick: runDisabled
                            ? undefined
                            : () => {
                                this.submitPrompt();
                              },

                          children: [
                            new Shape({
                              width: 9,
                              height: 9,
                              path: "M6.8 3.9 0 7.8V0L6.8 3.9Z",
                              pathBounds: Bounds.MakeXYWH(0, 0, 7, 8),
                              backgroundColor: "#ffffff",
                            }),

                            new Text(renderer, {
                              lineHeight: 18,
                              fontSize: 12,
                              fontFamily: font,
                              fontWeight: "500",
                              content: "Run",
                              color: "#FFFFFF",
                            }),
                          ],
                        }),
                  ],
                })
              : undefined,
          ],
        }),
      ],
    });

    this._view.performLayout();

    this.viewDirty = false;

    return this._view;
  }

  private submitPrompt() {
    const manager = this.manager;
    if (!manager) {
      throw new Error("StickyNode: No manager available");
    }

    if (
      !this.properties.resolved.textContent ||
      this.submittingPromptTimeout != null
    ) {
      return;
    }

    const model = this.properties.resolved.modelName;
    if (!model) {
      return;
    }

    manager.skiaRenderer.addFlashForNode(this, {
      longHold: true,
    });

    // NOTE(sedivy): Prevent multiple submissions within 2 seconds.
    this.submittingPromptTimeout = setTimeout(() => {
      this.submittingPromptTimeout = null;
      this.invalidateView();
    }, 2000);

    this.invalidateView();

    manager.submitPrompt(this.properties.resolved.textContent, model);
  }

  private invalidateView() {
    this.viewDirty = true;
    this.manager?.skiaRenderer.invalidateContent();
  }

  override handleViewClick(
    e: MouseEvent,
    worldX: number,
    worldY: number,
  ): boolean {
    const local = this.toLocal(worldX, worldY);

    if (this.getView().handleViewClick(e, local.x, local.y)) {
      return true;
    }

    return false;
  }

  override handleCursorForView(
    worldX: number,
    worldY: number,
  ): string | undefined {
    const local = this.toLocal(worldX, worldY);

    return this.getView().cursorForPoint(local.x, local.y);
  }

  override getViewAtPoint(
    worldX: number,
    worldY: number,
  ): Component<BaseProps> | undefined {
    const local = this.toLocal(worldX, worldY);

    return this.getView().getViewAtPoint(local.x, local.y);
  }

  override onPropertyChanged(property: keyof NodeProperties) {
    super.onPropertyChanged(property);

    if (
      property === "textContent" ||
      property === "width" ||
      property === "height" ||
      property === "fontFamily" ||
      property === "modelName"
    ) {
      this.invalidateView();
    }
  }

  getTextAreaInfo(renderer: SkiaRenderer): {
    bounds: ReadOnlyBounds;
    style: Partial<CSSStyleDeclaration>;
  } | null {
    // NOTE(sedivy): Make sure the view is up-to-date.
    this.getView();

    const textarea = this.textLayerRef.current;
    if (!textarea) {
      return null;
    }

    const fontWeight = convertFontWeightToSkiaVariation(
      textarea.props.fontWeight ?? "normal",
    );

    const matchedFont = renderer.fontManager.matchFont(
      textarea.props.fontFamily,
      fontWeight,
      false,
    );

    return {
      bounds: textarea.getNodeBounds(),

      style: {
        fontFamily: renderer.fontManager
          .getFontList(matchedFont)
          .map((f) => `"${f}"`)
          .join(", "),
        fontSize: `${textarea.props.fontSize}px`,
        lineHeight: textarea.props.lineHeight
          ? `${textarea.props.lineHeight}px`
          : "normal",
        fontWeight: String(fontWeight),
        color: textarea.props.color || "#000000",
      },
    };
  }

  override localBounds(): ReadOnlyBounds {
    const view = this.getView();

    const viewBounds = view.getNodeBounds();

    this._localBounds.set(0, 0, viewBounds.width, viewBounds.height);
    return this._localBounds;
  }

  override renderSkia(
    renderer: SkiaRenderer,
    canvas: Canvas,
    renderBounds: ReadOnlyBounds,
  ) {
    if (!this.properties.resolved.enabled) {
      return;
    }

    if (!renderBounds.intersects(this.getVisualWorldBounds())) {
      return;
    }

    const saveCount = canvas.getSaveCount();

    canvas.save();
    canvas.concat(this.localMatrix.toArray());

    this.getView().render(renderer, canvas);

    canvas.restoreToCount(saveCount);
  }

  destroy() {
    super.destroy();

    if (this.submittingPromptTimeout) {
      clearTimeout(this.submittingPromptTimeout);
      this.submittingPromptTimeout = null;
    }

    if (this._view) {
      this._view.destroy();
      this._view = null;
    }
    this.textLayerRef.current = null;

    this.isTextHidden = false;
  }

  serialize({
    resolveVariables,
  }: {
    resolveVariables: boolean;
    includePathGeometry: boolean;
  }): Schema.Note | Schema.Context | Schema.Prompt {
    let result: Schema.Note | Schema.Context | Schema.Prompt;

    switch (this.type) {
      case "note":
      case "context":
      case "prompt":
        result = {
          type: this.type,
          ...serializeCommon(this, resolveVariables),
        };
        break;
      default:
        throw new Error(`StickyNode: Unknown note type: ${this.type}`);
    }

    const properties = resolveVariables
      ? this.properties.resolved
      : this.properties;

    if (result.type === "prompt") {
      if (properties.modelName) {
        result.model = serializeValue(properties.modelName);
      }
    }

    serializeSize(result, this, resolveVariables);

    if (properties.textContent) {
      result.content = properties.textContent;
    }

    return result;
  }

  hideText() {
    this.isTextHidden = true;
    this.invalidateView();
  }

  showText() {
    this.isTextHidden = false;
    this.invalidateView();
  }
}
