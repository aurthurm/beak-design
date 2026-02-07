import type { Canvas, Paragraph, Path } from "@highagency/pencil-skia";
import {
  convertFontWeightToSkiaEnum,
  convertFontWeightToSkiaVariation,
  Skia,
} from "../../skia";
import type { SkiaRenderer } from "../../skia-renderer";
import { Bounds, type ReadOnlyBounds } from "../../utils/bounds";
import { FillType } from "../fill";
import { type BaseProps, Component } from "./component";

interface Props extends BaseProps {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  content?: string;
  lineHeight?: number;
  color?: string;
  textGrowth?: "auto" | "fixed-width" | "fixed-width-height";

  // TODO(sedivy): Our layout system doesn't have min and max size, so this is a
  // work around to enable it just for text.
  minHeight?: number;
}

export class Text extends Component<Props> {
  private _fillPath: Path | null = null;
  private fillPathDirty: boolean = true;

  private dirtyParagraph: boolean = true;
  private dirtyParagraphLayout: boolean = true;
  private paragraph?: Paragraph;

  private renderer: SkiaRenderer;

  constructor(renderer: SkiaRenderer, props: Props) {
    super(props);

    this.renderer = renderer;
  }

  override getRelativeBounds(): ReadOnlyBounds {
    const paragraph = this.getParagraph(this.renderer);

    let height = paragraph.getHeight();
    if (this.props.minHeight !== undefined) {
      height = Math.max(height, this.props.minHeight);
    }

    return Bounds.MakeXYWH(
      this.x ?? 0,
      this.y ?? 0,
      Math.ceil(paragraph.getMaxWidth()),
      Math.ceil(height),
    );
  }

  private getFillPath(renderer: SkiaRenderer): Path {
    if (this.fillPathDirty || this._fillPath == null) {
      if (this._fillPath) {
        this._fillPath.delete();
        this._fillPath = null;
      }

      this._fillPath = this.getParagraph(renderer).getPath();

      this.fillPathDirty = false;
    }

    return this._fillPath;
  }

  private getParagraph(renderer: SkiaRenderer): Paragraph {
    if (this.dirtyParagraph || !this.paragraph) {
      const fontWeight = convertFontWeightToSkiaVariation(
        this.props.fontWeight ?? "normal",
      );

      const matchedFont = renderer.fontManager.matchFont(
        this.props.fontFamily,
        fontWeight,
        false,
      );

      const fontSize = this.props.fontSize;
      const lineHeight = this.props.lineHeight ?? 0;

      const builder = Skia.ParagraphBuilder.MakeFromFontProvider(
        new Skia.ParagraphStyle({
          applyRoundingHack: false,
          textStyle: {
            fontFamilies: renderer.fontManager.getFontList(matchedFont),
            fontSize: fontSize,
            heightMultiplier: lineHeight / fontSize,
            halfLeading: true,
            fontStyle: {
              weight: convertFontWeightToSkiaEnum(
                this.props.fontWeight ?? "normal",
              ),
            },
            fontVariations: [
              {
                axis: "wght",
                value: fontWeight,
              },
            ],
          },
        }),
        renderer.fontManager.typefaceFontProvider,
      );
      builder.addText(this.props.content ?? "");

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
      switch (this.props.textGrowth ?? "auto") {
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
          this.paragraph.layout(Math.ceil(this.width ?? 0));
          break;
        }
      }

      this.dirtyParagraphLayout = false;
      this.fillPathDirty = true;
    }

    const unresolvedCodepoints = this.paragraph.unresolvedCodepoints();
    if (unresolvedCodepoints.length !== 0) {
      renderer.fontManager.loadFallbackFontsForMissingCodepoints(
        unresolvedCodepoints,
      );
    }

    return this.paragraph;
  }

  override render(renderer: SkiaRenderer, canvas: Canvas) {
    if (this.props.visible === false) {
      return;
    }

    const bounds = this.getRelativeBounds();

    canvas.save();
    canvas.translate(bounds.minX, bounds.minY);

    renderer.renderFills(
      canvas,
      this.getFillPath(renderer),
      [
        {
          enabled: true,
          type: FillType.Color,
          color: this.props.color ?? "#000000",
        },
      ],
      bounds.width,
      bounds.height,
    );

    canvas.restore();
  }

  override destroy() {
    super.destroy();

    if (this._fillPath) {
      this._fillPath.delete();
      this._fillPath = null;
    }

    if (this.paragraph) {
      this.paragraph.delete();
      this.paragraph = undefined;
    }

    this.fillPathDirty = true;
    this.dirtyParagraph = true;
    this.dirtyParagraphLayout = true;
  }
}
