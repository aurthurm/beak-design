import type { Canvas, Path } from "@highagency/pencil-skia";
import { hexToColor, Skia } from "../../skia";
import type { SkiaRenderer } from "../../skia-renderer";
import type { ReadOnlyBounds } from "../../utils/bounds";
import { safeRatio0 } from "../../utils/math";
import { type BaseProps, Component } from "./component";

interface Props extends BaseProps {
  path?: string;
  pathBounds?: ReadOnlyBounds;
  backgroundColor?: string;
  outlineColor?: string;
  outlineDash?: number[];
  outlineWidth?: number;
}

export class Shape extends Component<Props> {
  path: Path | null = null;

  constructor(props: Props) {
    super(props);

    if (props.path) {
      this.path = Skia.Path.MakeFromSVGString(props.path);
    }
  }

  override render(_renderer: SkiaRenderer, canvas: Canvas) {
    if (this.props.visible === false || !this.path) {
      return;
    }

    const bounds = this.getRelativeBounds();

    canvas.save();
    canvas.translate(bounds.minX, bounds.minY);

    if (this.props.pathBounds) {
      const scale = Math.min(
        safeRatio0(bounds.width, this.props.pathBounds.width),
        safeRatio0(bounds.height, this.props.pathBounds.height),
      );
      canvas.scale(scale, scale);
      canvas.translate(
        -this.props.pathBounds.minX,
        -this.props.pathBounds.minY,
      );
    }

    if (this.props.backgroundColor) {
      const paint = new Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(Skia.PaintStyle.Fill);
      paint.setColor(hexToColor(this.props.backgroundColor));
      canvas.drawPath(this.path, paint);
      paint.delete();
    }

    if (this.props.outlineColor && this.props.outlineWidth) {
      const strokePaint = new Skia.Paint();
      strokePaint.setAntiAlias(true);
      strokePaint.setColor(hexToColor(this.props.outlineColor));
      strokePaint.setStyle(Skia.PaintStyle.Stroke);
      strokePaint.setStrokeWidth(this.props.outlineWidth);
      strokePaint.setStrokeCap(Skia.StrokeCap.Round);
      strokePaint.setStrokeJoin(Skia.StrokeJoin.Round);

      if (this.props.outlineDash) {
        const effect = Skia.PathEffect.MakeDash(this.props.outlineDash, 0);
        strokePaint.setPathEffect(effect);
        effect.delete();
      }
      canvas.drawPath(this.path, strokePaint);
      strokePaint.delete();
    }

    canvas.restore();
  }

  override destroy() {
    super.destroy();

    if (this.path) {
      this.path.delete();
      this.path = null;
    }
  }
}
