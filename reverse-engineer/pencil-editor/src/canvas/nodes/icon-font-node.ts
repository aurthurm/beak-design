import type * as Schema from "@ha/schema";
import type { Canvas, Paragraph, Path } from "@highagency/pencil-skia";
import { Matrix } from "pixi.js";
import { lookupIconEntry, lookupIconSet } from "../../managers/icon-manager";
import { Skia } from "../../skia";
import type { SkiaRenderer } from "../../skia-renderer";
import { Bounds, type ReadOnlyBounds } from "../../utils/bounds";
import { expandBoundingBoxWithEffects } from "../effect";
import type { NodeProperties } from "../scene-graph";
import { SceneNode } from "../scene-node";
import {
  serializeCommon,
  serializeEffects,
  serializeFill,
  serializeSize,
  serializeValue,
} from "../serializer";

const BASE_FONT_SIZE = 14;

export class IconFontNode extends SceneNode {
  private dirtyParagraph: boolean = true;
  private paragraph?: Paragraph;

  private _fillPath: Path | null = null;
  private _fillPathBoundingBox: Bounds = new Bounds();
  private fillPathDirty: boolean = true;

  private _maskPath: Path | null = null;

  constructor(id: string, properties: NodeProperties) {
    super(id, "icon_font", properties);
  }

  override onPropertyChanged(property: keyof NodeProperties) {
    super.onPropertyChanged(property);

    if (property === "fontFamily") {
      this.dirtyParagraph = true;
      this.fillPathDirty = true;
    }

    if (
      property === "iconFontFamily" ||
      property === "iconFontName" ||
      property === "iconFontWeight"
    ) {
      this.dirtyParagraph = true;
      this.fillPathDirty = true;
    }
  }

  override getVisualLocalBounds(): ReadOnlyBounds {
    if (this.manager == null) {
      throw new Error(
        `Must be attached to a SceneGraph to query visual bounds!`,
      );
    }

    const bounds = this._visualLocalBounds;
    const fillBounds = this.getFillPath(this.manager.skiaRenderer)?.bounds;
    if (fillBounds) {
      bounds.copyFrom(fillBounds);
    } else {
      bounds.set(0, 0, 0, 0);
    }

    bounds.transform(this.getIconTransform());

    expandBoundingBoxWithEffects(this.properties.resolved.effects, bounds);

    return bounds;
  }

  getParagraph(renderer: SkiaRenderer): Paragraph | undefined {
    if (this.dirtyParagraph || !this.paragraph) {
      const fontWeight = this.properties.resolved.iconFontWeight ?? 200;

      const fontFamily = this.properties.resolved.iconFontFamily;
      if (!fontFamily) {
        return;
      }

      const iconName = this.properties.resolved.iconFontName;
      if (!iconName) {
        return;
      }

      const iconSet = lookupIconSet(fontFamily);
      if (!iconSet) {
        return;
      }

      const iconEntry = lookupIconEntry(iconSet, iconName);
      if (!iconEntry) {
        return;
      }

      const matchedFont = renderer.fontManager.matchFont(
        fontFamily,
        Number(fontWeight),
        false,
      );

      if (!matchedFont) {
        return;
      }

      // TODO(sedivy): Re-use existing ParagraphStyle.
      const paraStyle = new Skia.ParagraphStyle({
        applyRoundingHack: false,
        textStyle: {
          fontFamilies: renderer.fontManager.getFontList(matchedFont, false),
          heightMultiplier: 1,
          halfLeading: true,
          fontSize: BASE_FONT_SIZE,
          fontVariations: [
            {
              axis: "wght",
              value: fontWeight,
            },
          ],
        },
      });

      // TODO(sedivy): Re-use existing ParagraphBuilder.
      const builder = Skia.ParagraphBuilder.MakeFromFontProvider(
        paraStyle,
        renderer.fontManager.typefaceFontProvider,
      );

      const text =
        iconEntry.codepoint != null
          ? String.fromCodePoint(iconEntry.codepoint)
          : iconEntry.name;

      builder.addText(text);

      this.paragraph = builder.build();

      builder.delete();

      this.paragraph.layout(9999999);

      this.dirtyParagraph = false;
      this.fillPathDirty = true;
    }

    return this.paragraph;
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

    this.beginRenderEffects(canvas);

    canvas.concat(this.getIconTransform().toArray());

    // TODO(sedivy): Render a placeholder if path is missing?
    const paragraph = this.getParagraph(renderer);
    if (paragraph) {
      const width = paragraph.getMaxIntrinsicWidth();
      const height = paragraph.getHeight();

      const path = this.getFillPath(renderer)?.path;

      if (path) {
        renderer.renderFills(
          canvas,
          path,
          this.properties.resolved.fills,
          width,
          height,
        );
      }
    }

    canvas.restoreToCount(saveCount);
  }

  private getIconTransform(): Matrix {
    const matrix = new Matrix();
    if (this.manager) {
      const paragraph = this.getParagraph(this.manager.skiaRenderer);
      if (!paragraph) {
        return matrix;
      }

      const fontSize = Math.min(this.properties.width, this.properties.height);
      const scale = fontSize / BASE_FONT_SIZE;

      const width = paragraph.getMaxIntrinsicWidth();
      const height = paragraph.getHeight();

      const offsetX = (this.properties.width / scale - width) / 2;
      const offsetY = (this.properties.height / scale - height) / 2;

      matrix.translate(offsetX, offsetY);
      matrix.scale(scale, scale);
    }

    return matrix;
  }

  private getFillPath(renderer: SkiaRenderer):
    | {
        path: Path;
        bounds: ReadOnlyBounds;
      }
    | undefined {
    if (this.fillPathDirty || this._fillPath == null) {
      if (this._fillPath) {
        this._fillPath.delete();
        this._fillPath = null;
      }

      const path = this.getParagraph(renderer)?.getPath();
      if (!path) {
        return;
      }

      const bounds = path.computeTightBounds();

      this._fillPath = path;
      this._fillPathBoundingBox.set(bounds[0], bounds[1], bounds[2], bounds[3]);
      this.fillPathDirty = false;
    }

    return {
      path: this._fillPath,
      bounds: this._fillPathBoundingBox,
    };
  }

  override getMaskPath(): Path | undefined {
    if (this.manager) {
      const builder = new Skia.PathBuilder();

      const fill = this.getFillPath(this.manager.skiaRenderer)?.path;
      if (!fill) {
        return;
      }

      const transform = this.getIconTransform();

      builder.addPath(
        fill,
        transform.a,
        transform.c,
        transform.tx,
        transform.b,
        transform.d,
        transform.ty,
      );

      const path = builder.detachAndDelete();

      this._maskPath?.delete();
      this._maskPath = path;

      return this._maskPath;
    }
  }

  destroy() {
    super.destroy();

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
  }): Schema.IconFont {
    const result: Schema.IconFont = {
      type: "icon_font",
      ...serializeCommon(this, resolveVariables),
    };

    const properties = resolveVariables
      ? this.properties.resolved
      : this.properties;

    serializeSize(result, this, resolveVariables);

    if (properties.iconFontName) {
      result.iconFontName = serializeValue(properties.iconFontName);
    }

    if (properties.iconFontFamily) {
      result.iconFontFamily = serializeValue(properties.iconFontFamily);
    }

    if (properties.iconFontWeight && properties.iconFontWeight !== 200) {
      result.weight = serializeValue(properties.iconFontWeight);
    }

    result.fill = serializeFill(properties.fills);
    result.effect = serializeEffects(properties.effects);

    return result;
  }
}
