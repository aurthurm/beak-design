import type { Canvas, Paint } from "@highagency/pencil-skia";
import type { SceneNode } from "./canvas/scene-node";
import type { SceneManager } from "./managers/scene-manager";
import { Skia } from "./skia";
import type { ReadOnlyBounds } from "./utils/bounds";
import { almostEquals } from "./utils/math";

const SNAP_STROKE_WIDTH = 1; // screen space pixels
const CROSS_SIZE = 4; // screen space pixels
const MINIMUM_DISTANCE = 5; // screen space pixels
const SNAP_COLOR = [221 / 255, 63 / 255, 23 / 255, 0.8];

type RecordedSnap = {
  anchorPoints: [number, number][];
  pointsToSnap: [number, number][];
  position: number;
};

export class SnapManager {
  private manager: SceneManager;

  private bestDeltaPerAxis: [number, number] = [Infinity, Infinity];
  private recordedSnaps: [RecordedSnap[], RecordedSnap[]] = [[], []];

  private renderSnappedPoints: boolean = true;

  constructor(manager: SceneManager) {
    this.manager = manager;
  }

  reset() {
    this.bestDeltaPerAxis[0] = Infinity;
    this.bestDeltaPerAxis[1] = Infinity;

    this.recordedSnaps[0].length = 0;
    this.recordedSnaps[1].length = 0;

    this.renderSnappedPoints = true;
  }

  snapBounds(
    bounds: ReadOnlyBounds,
    selection: Set<SceneNode>,
    renderSnappedPoints: boolean,
    enabledAxes: [boolean, boolean] = [true, true],
  ): [number, number] {
    return this.snap(
      this.snapPointsForBounds(bounds),
      selection,
      renderSnappedPoints,
      enabledAxes,
    );
  }

  snapPoint(
    point: [number, number],
    selection: Set<SceneNode>,
    renderSnappedPoints: boolean,
    enabledAxes: [boolean, boolean] = [true, true],
  ): [number, number] {
    return this.snap([point], selection, renderSnappedPoints, enabledAxes);
  }

  snap(
    pointsToSnap: [number, number][],
    selection: Set<SceneNode>,
    renderSnappedPoints: boolean,
    enabledAxes: [boolean, boolean],
  ): [number, number] {
    this.reset();

    if (!this.manager.config.data.snapToObjects) {
      return [0, 0];
    }

    // NOTE(sedivy): The lead node will determine the snapping container. Right
    // now we take the first node, but in the future we would want to use the
    // actively dragged item in the selection.
    const lead = selection.values().next().value;
    if (!lead || !lead.parent) {
      return [0, 0];
    }
    const container = lead.parent;

    // NOTE(sedivy): Don't allow any snapping if any of the nodes are in layout.
    for (const node of selection) {
      if (node.isInLayout()) {
        return [0, 0];
      }
    }

    this.renderSnappedPoints = renderSnappedPoints;

    const minimum = MINIMUM_DISTANCE / this.manager.camera.zoom;

    // NOTE(sedivy): Include the parent frame in the snapping as well. This
    // allows users to align children into corners and sides.
    if (container.type === "frame") {
      this.findBestCandidate(
        this.snapPointsForNode(container),
        pointsToSnap,
        minimum,
        enabledAxes,
      );
    }

    this.findBestCandidateInContainer(
      selection,
      container,
      pointsToSnap,
      minimum,
      enabledAxes,
    );

    return [
      Number.isFinite(this.bestDeltaPerAxis[0]) ? this.bestDeltaPerAxis[0] : 0,
      Number.isFinite(this.bestDeltaPerAxis[1]) ? this.bestDeltaPerAxis[1] : 0,
    ];
  }

  private findBestCandidateInContainer(
    selection: Set<SceneNode>,
    container: SceneNode,
    pointsToSnap: [number, number][],
    minimum: number,
    enabledAxes: [boolean, boolean],
  ) {
    for (const node of container.children) {
      // NOTE(sedivy): Don't use nodes as anchor points if they in the selection.
      if (selection.has(node)) {
        continue;
      }

      // NOTE(sedivy): Don't use anchor points for nodes outside the viewport.
      if (!this.manager.camera.overlapsBounds(node.getWorldBounds())) {
        continue;
      }

      // NOTE(sedivy): Ignore groups by always visiting the children instead.
      // Groups should behave as if they weren't even there.
      if (node.type === "group") {
        this.findBestCandidateInContainer(
          selection,
          node,
          pointsToSnap,
          minimum,
          enabledAxes,
        );
      } else {
        this.findBestCandidate(
          this.snapPointsForNode(node),
          pointsToSnap,
          minimum,
          enabledAxes,
        );
      }
    }
  }

  private findBestCandidate(
    anchorPoints: [number, number][],
    pointsToSnap: [number, number][],
    minimum: number,
    enabledAxes: [boolean, boolean],
  ) {
    // NOTE(sedivy): Compare every point-to-snap against every anchor-point on each
    // axis and find the closest anchor.
    for (const point of pointsToSnap) {
      for (const anchorPoint of anchorPoints) {
        for (let axis = 0; axis < 2; axis++) {
          if (!enabledAxes[axis]) continue;

          const delta = anchorPoint[axis] - point[axis];

          const best = this.bestDeltaPerAxis[axis];
          if (Math.abs(delta) < minimum && Math.abs(delta) <= Math.abs(best)) {
            // NOTE(sedivy): We will be adjusting the best position as we are
            // iterating over the bounding boxes. If we find a bounding box
            // that's exactly the same as what we have currently we would still
            // want to display it in the UI. This means we have to keep an array
            // of the matches, but the moment we find a new closest bounding box
            // that's different we have to clear the list of recorded snaps.
            if (best !== delta) {
              this.recordedSnaps[axis].length = 0;
            }

            this.recordedSnaps[axis].push({
              anchorPoints,
              pointsToSnap,
              position: anchorPoint[axis],
            });
            this.bestDeltaPerAxis[axis] = delta;
          }
        }
      }
    }
  }

  private drawSnapPoint(
    axis: number,
    x: number,
    y: number,
    canvas: Canvas,
    paint: Paint,
  ) {
    if (axis === 1) {
      const tmp = x;
      x = y;
      y = tmp;
    }

    const size = CROSS_SIZE / 2 / this.manager.camera.zoom;
    canvas.drawLine(x - size, y - size, x + size, y + size, paint);
    canvas.drawLine(x + size, y - size, x - size, y + size, paint);
  }

  private drawSnapLine(
    axis: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    canvas: Canvas,
    paint: Paint,
  ) {
    if (axis === 0) {
      canvas.drawLine(x0, y0, x1, y1, paint);
    } else {
      canvas.drawLine(y0, x0, y1, x1, paint);
    }
  }

  render(canvas: Canvas) {
    const zoom = this.manager.camera.zoom;

    const paint = new Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(Skia.PaintStyle.Stroke);
    paint.setStrokeWidth(SNAP_STROKE_WIDTH / zoom);
    paint.setColor(SNAP_COLOR);
    paint.setStrokeCap(Skia.StrokeCap.Round);

    for (let axis = 0; axis < 2; axis++) {
      const crossAxis = axis === 0 ? 1 : 0;

      // NOTE(sediv): Because we record the position before they are
      // snapped they will be incorrect. We need to apply the delta after
      // everything is calculated to render them at the right position.
      const delta = Number.isFinite(this.bestDeltaPerAxis[axis])
        ? this.bestDeltaPerAxis[axis]
        : 0;
      const crossDelta = Number.isFinite(this.bestDeltaPerAxis[crossAxis])
        ? this.bestDeltaPerAxis[crossAxis]
        : 0;

      for (const snap of this.recordedSnaps[axis]) {
        let pointsMin = Infinity;
        let pointsMax = -Infinity;

        if (this.renderSnappedPoints) {
          for (const item of snap.pointsToSnap) {
            if (almostEquals(delta + item[axis], snap.position)) {
              const value = crossDelta + item[crossAxis];
              if (value < pointsMin) pointsMin = value;
              if (value > pointsMax) pointsMax = value;
            }
          }
        }

        let anchorsMin = Infinity;
        let anchorsMax = -Infinity;

        for (const item of snap.anchorPoints) {
          if (almostEquals(item[axis], snap.position)) {
            const value = item[crossAxis];
            if (value < anchorsMin) anchorsMin = value;
            if (value > anchorsMax) anchorsMax = value;
          }
        }

        const min = Math.min(anchorsMin, pointsMin);
        const max = Math.max(anchorsMax, pointsMax);

        // NOTE(sedivy): Line is rendered between the min and max of all snap points.
        if (Number.isFinite(min) && Number.isFinite(max)) {
          this.drawSnapPoint(axis, snap.position, pointsMin, canvas, paint);
          if (pointsMin !== pointsMax) {
            this.drawSnapPoint(axis, snap.position, pointsMax, canvas, paint);
          }

          this.drawSnapPoint(axis, snap.position, anchorsMin, canvas, paint);
          if (anchorsMin !== anchorsMax) {
            this.drawSnapPoint(axis, snap.position, anchorsMax, canvas, paint);
          }

          this.drawSnapLine(
            axis,
            snap.position,
            min,
            snap.position,
            max,
            canvas,
            paint,
          );
        }
      }
    }

    paint.delete();
  }

  private snapPointsForNode(node: SceneNode): [number, number][] {
    const points = node.getSnapPoints();

    this.roundSnapPoints(points);

    return points;
  }

  private snapPointsForBounds(bounds: ReadOnlyBounds): [number, number][] {
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    const points: [number, number][] = [
      [bounds.left, bounds.top],
      [bounds.right, bounds.top],
      [centerX, centerY],
      [bounds.left, bounds.bottom],
      [bounds.right, bounds.bottom],
    ];

    this.roundSnapPoints(points);

    return points;
  }

  private roundSnapPoints(points: [number, number][]) {
    if (this.manager.config.data.roundToPixels) {
      for (const point of points) {
        point[0] = Math.round(point[0]);
        point[1] = Math.round(point[1]);
      }
    }
  }
}
