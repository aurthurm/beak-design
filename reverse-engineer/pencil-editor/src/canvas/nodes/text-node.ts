import type * as Schema from "@ha/schema";
import type { Canvas, Paragraph, Path } from "@highagency/pencil-skia";
import {
  convertFontStyleToSkiaEnum,
  convertFontStyleToSkiaSlantVariation,
  convertFontWeightToSkiaEnum,
  convertFontWeightToSkiaVariation,
  convertTextAlignToSkia,
  Skia,
} from "../../skia";
import type { SkiaRenderer } from "../../skia-renderer";
import { Bounds, type ReadOnlyBounds } from "../../utils/bounds";
import { almostEquals } from "../../utils/math";
import { expandBoundingBoxWithEffects } from "../effect";
import type { NodeProperties } from "../scene-graph";
import { SceneNode } from "../scene-node";
import {
  serializeCommon,
  serializeEffects,
  serializeFill,
  serializeSingleAxisSize,
  serializeStroke,
  serializeValue,
} from "../serializer";

export class TextNode extends SceneNode {
  private dirtyParagraph: boolean = true;
  private dirtyParagraphLayout: boolean = true;
  private paragraph?: Paragraph;

  private _fillPath: Path | null = null;
  private _fillPathBoundingBox: Bounds = new Bounds();
  private fillPathDirty: boolean = true;

  private _textLayoutBounds: Bounds = new Bounds();

  private _maskPath: Path | null = null;

  isTextHidden: boolean = false;

  constructor(id: string, properties: NodeProperties) {
    super(id, "text", properties);
  }

  localBounds(): ReadOnlyBounds {
    // TODO(sedivy): Only update the bounds when there was a change

    this._localBounds.copyFrom(this.textLayoutBounds());
    if (this.properties.textGrowth === "fixed-width-height") {
      this._localBounds.height = this.properties.height;
    }
    return this._localBounds;
  }

  textLayoutBounds(): ReadOnlyBounds {
    if (this.destroyed) {
      return new Bounds();
    }

    if (!this.manager) {
      throw new Error(`Must be attached to a SceneGraph to layout text!`);
    }

    // TODO(sedivy): Only update the bounds when there was a change

    const paragraph = this.getParagraph(this.manager.skiaRenderer);

    switch (this.properties.textGrowth) {
      case "fixed-width": {
        this._textLayoutBounds.setXYWH(
          0,
          0,
          this.properties.width,
          Math.ceil(paragraph.getHeight()),
        );
        break;
      }

      case "fixed-width-height": {
        this._textLayoutBounds.setXYWH(
          0,
          0,
          this.properties.width,
          Math.ceil(paragraph.getHeight()),
        );
        break;
      }

      default: {
        this._textLayoutBounds.setXYWH(
          0,
          0,
          Math.ceil(paragraph.getMaxIntrinsicWidth()),
          Math.ceil(paragraph.getHeight()),
        );
        break;
      }
    }

    return this._textLayoutBounds;
  }

  override onPropertyChanged(property: keyof NodeProperties) {
    super.onPropertyChanged(property);

    if (
      property === "fontFamily" ||
      property === "textAlign" ||
      property === "fontWeight" ||
      property === "textContent" ||
      property === "textGrowth" ||
      property === "lineHeight" ||
      property === "letterSpacing" ||
      property === "fontSize"
    ) {
      this.dirtyParagraph = true;
      this.fillPathDirty = true;
    }

    if (
      property === "fontFamily" ||
      property === "fontWeight" ||
      property === "textContent" ||
      property === "lineHeight" ||
      property === "letterSpacing" ||
      property === "fontSize"
    ) {
      this.manager?.scenegraph.invalidateLayout(this);
    }

    if (property === "width") {
      if (
        this.properties.textGrowth === "fixed-width" ||
        this.properties.textGrowth === "fixed-width-height"
      ) {
        this.dirtyParagraphLayout = true;
        this.fillPathDirty = true;
      }
    }
  }

  getTextAreaInfo(renderer: SkiaRenderer): {
    bounds: ReadOnlyBounds;
    style: Partial<CSSStyleDeclaration>;
  } | null {
    const bounds = this.localBounds();

    const fontSize = this.properties.resolved.fontSize;

    const lineHeight =
      this.properties.resolved.lineHeight === 0
        ? "normal"
        : `${Math.round(this.properties.resolved.lineHeight * fontSize) / fontSize}`;

    const fontWeight = convertFontWeightToSkiaVariation(
      this.properties.resolved.fontWeight,
    );

    const matchedFont = renderer.fontManager.matchFont(
      this.properties.resolved.fontFamily ?? "Inter",
      fontWeight,
      this.properties.resolved.fontStyle === "italic",
    );

    let justifyContent = "start";

    switch (this.properties.textAlignVertical) {
      case "middle": {
        justifyContent = "center";
        break;
      }
      case "bottom": {
        justifyContent = "end";
        break;
      }
    }

    return {
      bounds: bounds,

      style: {
        color: this.getFirstFillColor() ?? "black",

        justifyContent: justifyContent,
        lineHeight: lineHeight,
        fontSize: `${fontSize}px`,
        textAlign: this.properties.resolved.textAlign,
        fontWeight: this.properties.resolved.fontWeight,
        fontStyle: this.properties.resolved.fontStyle,
        letterSpacing: `${this.properties.resolved.letterSpacing / fontSize}em`,

        fontFamily: renderer.fontManager
          .getFontList(matchedFont)
          .map((f) => `"${f}"`)
          .join(", "),
      },
    };
  }

  getParagraphPosition(renderer: SkiaRenderer): [number, number] {
    const paragraph = this.getParagraph(renderer);

    const position: [number, number] = [-this.properties.letterSpacing / 2, 0];

    if (
      this.properties.textGrowth != null &&
      this.properties.textGrowth !== "auto"
    ) {
      switch (this.properties.textAlignVertical) {
        case "top": {
          break;
        }
        case "middle": {
          position[1] = (this.localBounds().height - paragraph.getHeight()) / 2;
          break;
        }
        case "bottom": {
          position[1] += this.localBounds().height - paragraph.getHeight();
          break;
        }
      }
    }

    return position;
  }

  override getVisualLocalBounds(): ReadOnlyBounds {
    if (this.manager == null) {
      throw new Error(
        `Must be attached to a SceneGraph to query visual bounds!`,
      );
    }

    const bounds = this._visualLocalBounds;
    bounds.copyFrom(this.getFillPath(this.manager.skiaRenderer).bounds);

    expandBoundingBoxWithEffects(this.properties.resolved.effects, bounds);

    return bounds;
  }

  getParagraph(renderer: SkiaRenderer): Paragraph {
    const textGrowth = this.properties.textGrowth;
    const fontSize = this.properties.resolved.fontSize;

    if (this.dirtyParagraph || !this.paragraph) {
      const fontWeight = convertFontWeightToSkiaVariation(
        this.properties.resolved.fontWeight,
      );

      const matchedFont = renderer.fontManager.matchFont(
        this.properties.resolved.fontFamily ?? "Inter",
        fontWeight,
        this.properties.resolved.fontStyle === "italic",
      );

      const builder = Skia.ParagraphBuilder.MakeFromFontProvider(
        new Skia.ParagraphStyle({
          applyRoundingHack: false,
          textStyle: {
            fontFamilies: renderer.fontManager.getFontList(matchedFont),
            fontSize: fontSize,
            // NOTE(sedivy): We need to round the line height to pixels.
            heightMultiplier:
              this.properties.resolved.lineHeight !== 0
                ? Math.round(this.properties.resolved.lineHeight * fontSize) /
                  fontSize
                : undefined,
            halfLeading: true,
            letterSpacing: this.properties.resolved.letterSpacing,
            fontStyle: {
              weight: convertFontWeightToSkiaEnum(
                this.properties.resolved.fontWeight,
              ),
              slant: convertFontStyleToSkiaEnum(
                this.properties.resolved.fontStyle,
              ),
            },
            fontVariations: [
              {
                axis: "wght",
                value: fontWeight,
              },
              {
                axis: "slnt",
                value: convertFontStyleToSkiaSlantVariation(
                  this.properties.resolved.fontStyle,
                ),
              },
            ],
          },
          textAlign: convertTextAlignToSkia(this.properties.textAlign),
        }),
        renderer.fontManager.typefaceFontProvider,
      );
      builder.addText(this.properties.textContent ?? "");

      if (this.paragraph) {
        this.paragraph.delete();
      }

      this.paragraph = builder.build();

      builder.delete();

      this.dirtyParagraph = false;
      this.dirtyParagraphLayout = true;
      this.fillPathDirty = true;
    }

    if (this.dirtyParagraphLayout) {
      switch (textGrowth) {
        case "auto": {
          // NOTE(sedivy): Do the layout twice, first to figure out the max
          // intrinsic width and then second time to have layout with the right
          // bounding box.
          //
          // Without this any multi-line text with alignment will be broken.
          // TODO(sedivy): Is there some hidden Skia API to do this properly?
          this.paragraph.layout(999999999);
          this.paragraph.layout(this.paragraph.getMaxIntrinsicWidth());
          break;
        }

        case "fixed-width":
        case "fixed-width-height": {
          this.paragraph.layout(Math.ceil(this.properties.width ?? 0));
          break;
        }
      }
      this.dirtyParagraphLayout = false;
      this.fillPathDirty = true;
    }

    // NOTE(zaza): the font fallback algorithm only works deterministically if the fallback fonts
    // cover disjoint subsets of Unicode. If this is not the case, then the exact fallback font used
    // for a particular glyph will depend on the order in which the missing codepoints appeared.
    const unresolvedCodepoints = this.paragraph.unresolvedCodepoints();
    if (unresolvedCodepoints.length !== 0) {
      renderer.fontManager.loadFallbackFontsForMissingCodepoints(
        unresolvedCodepoints,
      );
    }

    return this.paragraph;
  }

  private getFillPath(renderer: SkiaRenderer): {
    path: Path;
    bounds: ReadOnlyBounds;
  } {
    if (this.fillPathDirty || this._fillPath == null) {
      if (this._fillPath) {
        this._fillPath.delete();
        this._fillPath = null;
      }

      const path = this.getParagraph(renderer).getPath();
      const bounds = path.computeTightBounds();

      const position = this.getParagraphPosition(renderer);

      this._fillPath = path;
      this._fillPathBoundingBox.set(
        bounds[0] + position[0],
        bounds[1] + position[1],
        bounds[2] + position[0],
        bounds[3] + position[1],
      );
      this.fillPathDirty = false;
    }

    return { path: this._fillPath, bounds: this._fillPathBoundingBox };
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

    if (!this.isTextHidden) {
      this.beginRenderEffects(canvas);

      const position = this.getParagraphPosition(renderer);

      canvas.translate(position[0], position[1]);

      const localBounds = this.localBounds();

      // TODO(sedivy): In the future we will want to export many vector paths for
      // each text style and render them separately with a custom Paint.
      renderer.renderFills(
        canvas,
        this.getFillPath(renderer).path,
        this.properties.resolved.fills,
        localBounds.width,
        localBounds.height,
      );
    }

    canvas.restoreToCount(saveCount);
  }

  override getMaskPath(): Path | undefined {
    if (this.manager) {
      const fill = this.getFillPath(this.manager.skiaRenderer).path;

      const builder = new Skia.PathBuilder();
      const position = this.getParagraphPosition(this.manager.skiaRenderer);
      builder.addPath(fill, 1, 0, position[0], 0, 1, position[1]);
      const path = builder.detachAndDelete();

      this._maskPath?.delete();
      this._maskPath = path;

      return this._maskPath;
    }
  }

  override supportsImageFill(): boolean {
    return true;
  }

  destroy() {
    super.destroy();

    this.isTextHidden = false;

    if (this._maskPath) {
      this._maskPath.delete();
      this._maskPath = null;
    }

    if (this._fillPath) {
      this._fillPath.delete();
      this._fillPath = null;
    }

    this.fillPathDirty = true;

    if (this.paragraph) {
      this.paragraph.delete();
      this.paragraph = undefined;
    }
  }

  serialize({
    resolveVariables,
  }: {
    resolveVariables: boolean;
    includePathGeometry: boolean;
  }): Schema.Text {
    const result: Schema.Text = {
      type: "text",
      ...serializeCommon(this, resolveVariables),
    };

    const properties = resolveVariables
      ? this.properties.resolved
      : this.properties;

    result.fill = serializeFill(properties.fills);

    result.stroke = serializeStroke(properties);
    result.effect = serializeEffects(properties.effects);

    switch (properties.textGrowth) {
      case "auto": {
        break;
      }

      case "fixed-width": {
        result.textGrowth = properties.textGrowth;
        result.width =
          serializeSingleAxisSize(
            this,
            properties.width,
            properties.horizontalSizing,
          ) ?? 0;
        break;
      }

      case "fixed-width-height": {
        result.textGrowth = properties.textGrowth;
        result.width =
          serializeSingleAxisSize(
            this,
            properties.width,
            properties.horizontalSizing,
          ) ?? 0;
        result.height = serializeSingleAxisSize(
          this,
          properties.height,
          properties.verticalSizing,
        );
        break;
      }
    }

    if (properties.textContent !== "") {
      result.content = properties.textContent;
    }

    if (properties.lineHeight !== 0) {
      result.lineHeight = serializeValue(properties.lineHeight);
    }

    if (properties.textAlign !== "left") {
      result.textAlign = properties.textAlign;
    }

    if (properties.textAlignVertical !== "top") {
      result.textAlignVertical = properties.textAlignVertical;
    }

    if (properties.fontFamily !== "") {
      result.fontFamily = serializeValue(properties.fontFamily);
    }

    result.fontSize = serializeValue(properties.fontSize);

    if (properties.fontWeight !== "400") {
      result.fontWeight = serializeValue(properties.fontWeight);
    }

    if (properties.letterSpacing !== 0) {
      result.letterSpacing = serializeValue(properties.letterSpacing);
    }

    if (properties.fontStyle !== "normal") {
      result.fontStyle = serializeValue(properties.fontStyle);
    }

    return result;
  }

  isEmpty(): boolean {
    return !this.properties.textContent;
  }

  override getSnapPoints(): [number, number][] {
    if (!this.manager) {
      throw new Error(`Must be attached to a SceneGraph to query snap points!`);
    }

    const points = super.getSnapPoints();

    // NOTE(sedivy): Include each line of the text as a snapping point. We don't
    // want to include it when the text is rotated because then the lines would
    // be weirdly overlapping in the axis-aligned coordinate system.
    if (
      this.properties.resolved.rotation == null ||
      almostEquals(this.properties.resolved.rotation, 0)
    ) {
      const position = this.getParagraphPosition(this.manager.skiaRenderer);
      const paragraph = this.getParagraph(this.manager.skiaRenderer);

      const bounds = this.getWorldBounds();

      position[0] += bounds.left;
      position[1] += bounds.top;

      const lines = paragraph.getLineMetrics();

      for (const line of lines) {
        points.push([
          position[0] + line.left,
          position[1] + Math.round(line.ascent),
        ]);

        points.push([
          position[0] + line.left + line.width,
          position[1] + Math.round(line.ascent),
        ]);

        position[1] += line.height;
      }
    }

    return points;
  }

  hideText() {
    this.isTextHidden = true;
    this.manager?.skiaRenderer.invalidateContent();
  }

  showText() {
    this.isTextHidden = false;
    this.manager?.skiaRenderer.invalidateContent();
  }
}
