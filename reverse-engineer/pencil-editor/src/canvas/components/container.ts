import type { Canvas } from "@highagency/pencil-skia";
import { hexToColor, Skia } from "../../skia";
import type { SkiaRenderer } from "../../skia-renderer";
import { type BaseProps, Component } from "./component";

interface Props extends BaseProps {
  cornerRadius?: number;
  backgroundColor?: string;
  outlineColor?: string;
  outlineDash?: number[];
  outlineWidth?: number;
  opacity?: number;
}

export class Container extends Component<Props> {
  override render(renderer: SkiaRenderer, canvas: Canvas) {
    if (this.props.visible === false) {
      return;
    }

    const opacity = this.props.opacity ?? 1;
    if (opacity <= 0) {
      return;
    }

    const saveCount = canvas.getSaveCount();

    if (opacity < 1) {
      const paint = new Skia.Paint();
      paint.setAlphaf(opacity);
      canvas.saveLayer(paint);
      paint.delete();
    }

    const bounds = this.getRelativeBounds();

    const rect = Skia.RRectXY(
      Skia.XYWHRect(bounds.left, bounds.top, bounds.width, bounds.height),
      this.props.cornerRadius ?? 0,
      this.props.cornerRadius ?? 0,
    );

    if (this.props.backgroundColor) {
      const paint = new Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(Skia.PaintStyle.Fill);
      paint.setColor(hexToColor(this.props.backgroundColor));
      canvas.drawRRect(rect, paint);
      paint.delete();
    }

    canvas.save();
    canvas.translate(bounds.minX, bounds.minY);

    if (this.props.clip) {
      canvas.clipRRect(rect, Skia.ClipOp.Intersect, true);
    }

    if (this.children) {
      for (const child of this.children) {
        child.render(renderer, canvas);
      }
    }

    canvas.restore();

    if (this.props.outlineColor && this.props.outlineWidth) {
      const width = this.props.outlineWidth;

      const strokePaint = new Skia.Paint();
      strokePaint.setAntiAlias(true);
      strokePaint.setColor(hexToColor(this.props.outlineColor));
      strokePaint.setStyle(Skia.PaintStyle.Stroke);
      strokePaint.setStrokeWidth(width);

      const offset = width;

      const rect = Skia.RRectXY(
        Skia.XYWHRect(
          bounds.left + offset / 2,
          bounds.top + offset / 2,
          bounds.width - offset,
          bounds.height - offset,
        ),
        Math.max(0, (this.props.cornerRadius ?? 0) - offset),
        Math.max(0, (this.props.cornerRadius ?? 0) - offset),
      );

      if (this.props.outlineDash) {
        const effect = Skia.PathEffect.MakeDash(this.props.outlineDash, 0);
        strokePaint.setPathEffect(effect);
        effect.delete();
      }
      canvas.drawRRect(rect, strokePaint);
      strokePaint.delete();
    }

    canvas.restoreToCount(saveCount);
  }
}
