import type { Canvas } from "@highagency/pencil-skia";
import { Axis, FrameNode } from "../canvas";
import { NodeUtils } from "../canvas/node-utils";
import type { ObjectUpdateBlock } from "../canvas/object-update-block";
import type { SceneNode } from "../canvas/scene-node";
import type { SceneManager } from "../managers/scene-manager";
import { Skia } from "../skia";
import type { SkiaRenderer } from "../skia-renderer";
import { COLORS, clamp } from "../utils";
import type { Bounds, ReadOnlyBounds } from "../utils/bounds";
import { IdleState } from "./idle-state";
import type { InteractionState } from "./interaction-state";

export class MovingState implements InteractionState {
  private manager: SceneManager;

  private nodes: {
    node: SceneNode;
    offsetFromBoundingBox: [number, number];
    parent: SceneNode | undefined;
    originalIndex: number;
  }[] = [];

  private nodeSet: Set<SceneNode> = new Set<SceneNode>();
  private draggingBounds?: Bounds = undefined;

  private mouseBoundsOffset: [number, number] = [0, 0];

  private originalUndoSnapshot?: ObjectUpdateBlock = undefined;

  private startingContainer?: SceneNode = undefined;

  private deferredDropNode?: SceneNode = undefined;
  private deferredDropChildIndex?: number = undefined;

  constructor(manager: SceneManager) {
    this.manager = manager;
  }

  onEnter(): void {
    if (!this.manager.input) {
      return;
    }

    this.deferredDropNode = undefined;
    this.deferredDropChildIndex = undefined;

    this.draggingBounds = undefined;

    this.manager.didDrag = false;

    this.nodes.length = 0;
    this.nodeSet.clear();

    this.mouseBoundsOffset[0] = 0;
    this.mouseBoundsOffset[1] = 0;

    this.manager.snapManager.reset();

    this.originalUndoSnapshot = this.manager.scenegraph.beginUpdate();

    const mouse = this.manager.input.worldMouse;

    const inputNodes = this.manager.selectionManager.selectedNodes;

    for (const node of inputNodes) {
      if (
        // NOTE(zaza): Don't change the structure of instances.
        node.parent?.prototype &&
        !node.parent.prototype.childrenOverridden &&
        !(node.parent instanceof FrameNode && node.parent.isSlotInstance)
      ) {
        continue;
      }

      this.nodeSet.add(node);
    }

    const bounds = NodeUtils.calculateCombinedBoundsNew(this.nodeSet);
    if (bounds) {
      this.draggingBounds = bounds;

      for (const node of this.nodeSet) {
        this.manager.removeAnimation(node);

        const pos = node.getGlobalPosition();
        const parent = node.parent ?? undefined;

        this.nodes.push({
          node,
          offsetFromBoundingBox: [pos.x - bounds.x, pos.y - bounds.y],
          parent,
          originalIndex: parent ? parent.childIndex(node) : 0,
        });
      }

      this.mouseBoundsOffset[0] = bounds.x - mouse.x;
      this.mouseBoundsOffset[1] = bounds.y - mouse.y;
    }

    // NOTE(sedivy): Sort nodes by their child index in each parent.
    {
      const byParent = new Map<SceneNode | undefined, typeof this.nodes>();

      for (const item of this.nodes) {
        let group = byParent.get(item.parent);
        if (!group) {
          group = [];
          byParent.set(item.parent, group);
        }
        group.push(item);
      }

      for (const group of byParent.values()) {
        group.sort((a, b) => a.originalIndex - b.originalIndex);
      }

      this.nodes = Array.from(byParent.values()).flat();
    }

    // NOTE(sedivy): Snapshot all properties after the sort that will be modified in the onPointerMove event.
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const item = this.nodes[i];

      this.originalUndoSnapshot.snapshotProperties(item.node, ["x", "y"]);
      this.originalUndoSnapshot.snapshotParent(item.node);
    }

    this.startingContainer = undefined;

    this.startingContainer =
      this.manager.selectionManager.findFrameForPosition(
        mouse.x,
        mouse.y,
        undefined,
        inputNodes,
      ) ?? undefined;

    this.manager.selectionManager.updateMultiSelectGuides();

    this.manager.guidesGraph.disableInteractions();
    this.manager.guidesGraph.hideAllBoundingBoxes();
  }

  onExit(): void {
    if (!this.manager.input) {
      return;
    }

    if (this.manager.didDrag) {
      const deferredTarget = this.deferredDropNode;
      if (deferredTarget) {
        const block = this.manager.scenegraph.beginUpdate();

        let index = this.deferredDropChildIndex;
        if (index != null) {
          const isHorizontal =
            deferredTarget.hasLayout() &&
            deferredTarget.layout.direction === Axis.Horizontal;

          this.nodes.sort((a, b) => {
            const boundsA = a.node.getWorldBounds();
            const boundsB = b.node.getWorldBounds();

            return isHorizontal ? boundsB.x - boundsA.x : boundsB.y - boundsA.y;
          });

          for (const item of this.nodes) {
            const currentIndex = deferredTarget.childIndex(item.node);
            if (currentIndex !== -1 && currentIndex < index) {
              index--;
            }
          }
        }

        const modifiedTargets = new Set<SceneNode>([deferredTarget]);

        for (const item of this.nodes) {
          const node = item.node;

          // NOTE(sedivy): Animate the original parent.
          if (
            node.parent &&
            node.parent !== deferredTarget &&
            node.parent.hasLayout()
          ) {
            modifiedTargets.add(node.parent);
          }

          const worldPos = node.getGlobalPosition();

          block.changeParent(
            item.node,
            deferredTarget,
            index != null
              ? clamp(0, index, deferredTarget.children.length)
              : undefined,
          );

          const localPos = node.toLocalPointFromParent(worldPos.x, worldPos.y);

          block.update(node, {
            x: localPos.x,
            y: localPos.y,
          });
        }

        // NOTE(sedivy): Animate the layout change caused by the node drop.
        this.manager.animateLayoutChange(modifiedTargets, undefined);

        this.manager.scenegraph.commitBlock(block, { undo: false });
      }

      if (this.originalUndoSnapshot) {
        this.manager.scenegraph.commitBlock(this.originalUndoSnapshot, {
          undo: true,
        });
        this.originalUndoSnapshot = undefined;
      }
    }

    this.manager.didDrag = false;

    for (const item of this.nodes) {
      item.node.renderOnTop = false;

      this.manager.animateVisualOffset(
        item.node,
        item.node.visualOffset[0],
        item.node.visualOffset[1],
      );
    }
    this.nodes.length = 0;
    this.nodeSet.clear();

    this.startingContainer = undefined;

    this.deferredDropNode = undefined;
    this.deferredDropChildIndex = undefined;

    this.manager.snapManager.reset();

    this.manager.guidesGraph.enableInteractions();
    this.manager.guidesGraph.showAllBoundingBoxes();

    this.manager.selectionManager.updateMultiSelectGuides();
    this.manager.skiaRenderer.invalidateContent();
  }

  onPointerMove(event: MouseEvent): void {
    if (!this.manager.input) {
      return;
    }

    if (!this.draggingBounds) {
      return;
    }

    this.manager.didDrag = true;
    this.deferredDropNode = undefined;
    this.deferredDropChildIndex = undefined;

    this.manager.snapManager.reset();

    const mouse = this.manager.input.worldMouse;

    const container = this.startingContainer;

    this.manager.scenegraph.updateLayout();

    if (
      container?.hasLayout() &&
      container.containsPointInBoundingBox(mouse.x, mouse.y)
    ) {
      // NOTE(sedivy): lead node is still overlapping it's layout container. Only do reordering.
      this.reorderNodes(container);
    } else if (
      container == null ||
      !container.containsPointInBoundingBox(mouse.x, mouse.y)
    ) {
      // NOTE(sedivy): We have left the original container. Find a new drop target.

      const dropContainer =
        this.findDropFrame(
          mouse.x,
          mouse.y,
          this.draggingBounds.width,
          this.draggingBounds.height,
          event.metaKey || event.ctrlKey,
        ) ?? this.manager.scenegraph.getViewportNode();

      if (
        // NOTE(sedivy): We don't want to modify another layout container while
        // dragging, defer the drop operation until pointer up.
        dropContainer.hasLayout() ||
        (dropContainer instanceof FrameNode && dropContainer.isSlotInstance) // NOTE(sedivy): Defer dropping into slots
      ) {
        this.deferredDropNode = dropContainer;
        this.deferredDropChildIndex = dropContainer.findInsertionIndexInLayout(
          mouse.x,
          mouse.y,
          this.nodeSet,
        );

        // NOTE(sedivy): While dragging over a deferred container we temporarily
        // move the nodes to the viewport so the nodes still follow the mouse.
        this.translateNodes(this.manager.scenegraph.getViewportNode(), false);
      } else {
        // NOTE(sedivy): Immediate drop into non-layout container.
        this.translateNodes(dropContainer, !event.ctrlKey);
      }
    } else {
      // NOTE(sedivy): Mouse is back inside the original container. Revert any parent changes.
      this.translateNodes(undefined, !event.ctrlKey);
    }

    this.manager.connectionManager.redrawAllConnections();
  }

  private reorderNodes(container: SceneNode) {
    if (!this.manager.input) {
      return;
    }

    const mouse = this.manager.input.worldMouse;

    const foundIndex = container.findInsertionIndexInLayout(
      mouse.x,
      mouse.y,
      this.nodeSet,
    );

    const indexOffsetPerParent = new Map<SceneNode, number>();

    const modifiedTargets = new Set<SceneNode>();
    const animationIgnoreSet = new Set(this.nodeSet);

    const block = this.manager.scenegraph.beginUpdate();

    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const item = this.nodes[i];

      const node = item.node;

      // NOTE(sedivy): While dragging, render the nodes on top of other content to make them more visible.
      node.renderOnTop = true;

      const originalParent =
        item.parent ?? this.manager.scenegraph.getViewportNode();

      let index = foundIndex;

      if (index != null) {
        const indexOffset = indexOffsetPerParent.get(originalParent) ?? 0;

        index -= indexOffset;

        const currentIndex = originalParent.childIndex(node);
        if (currentIndex < index) {
          indexOffsetPerParent.set(originalParent, indexOffset + 1);
          index--;
        }
      }

      if (
        node.parent !== originalParent ||
        originalParent.childIndex(node) !== index
      ) {
        modifiedTargets.add(originalParent);

        block.changeParent(node, originalParent, index);
      }

      // NOTE(sedivy): Allow animation for nodes that are still selected but that are in other layout nodes.
      if (item.parent !== container) {
        animationIgnoreSet.delete(node);
      }
    }

    // NOTE(sedivy): Animate all siblings that are affected by layout changes.
    this.manager.animateLayoutChange(modifiedTargets, animationIgnoreSet);

    // NOTE(sedivy): When dragging nodes that are inside layout we can't adjust
    // the normal x/y position because that's controlled by the layout system.
    // Instead we use visual offsets to move the nodes so they appear to follow
    // the mouse.
    const newBoundingBoxX = mouse.x + this.mouseBoundsOffset[0];
    const newBoundingBoxY = mouse.y + this.mouseBoundsOffset[1];

    for (const item of this.nodes) {
      const node = item.node;

      if (node.parent === container) {
        const targetX = newBoundingBoxX + item.offsetFromBoundingBox[0];
        const targetY = newBoundingBoxY + item.offsetFromBoundingBox[1];

        const currentWorldPosition = node.getGlobalPosition();

        const deltaX = targetX - currentWorldPosition.x;
        const deltaY = targetY - currentWorldPosition.y;

        const origin = node.toLocalPointFromParent(0, 0);
        const localDelta = node.toLocalPointFromParent(deltaX, deltaY);

        node.setVisualOffset(
          node.visualOffset[0] + localDelta.x - origin.x,
          node.visualOffset[1] + localDelta.y - origin.y,
        );
      }
    }

    this.manager.scenegraph.commitBlock(block, { undo: false });
  }

  private translateNodes(
    targetContainer: SceneNode | undefined,
    snap: boolean,
  ): void {
    if (!this.draggingBounds || !this.manager.input) {
      return;
    }

    const block = this.manager.scenegraph.beginUpdate();

    const mouse = this.manager.input.worldMouse;

    let newBoundingBoxX = mouse.x + this.mouseBoundsOffset[0];
    let newBoundingBoxY = mouse.y + this.mouseBoundsOffset[1];

    if (this.manager.config.data.roundToPixels) {
      newBoundingBoxX = Math.round(newBoundingBoxX);
      newBoundingBoxY = Math.round(newBoundingBoxY);
    }

    this.draggingBounds.x = newBoundingBoxX;
    this.draggingBounds.y = newBoundingBoxY;

    if (snap) {
      const offset = this.manager.snapManager.snapBounds(
        this.draggingBounds,
        this.nodeSet,
        true,
      );

      newBoundingBoxX += offset[0];
      newBoundingBoxY += offset[1];
    } else {
      this.manager.snapManager.reset();
    }

    const modifiedTargets = new Set<SceneNode>();

    for (const item of this.nodes) {
      const node = item.node;

      let targetParent =
        targetContainer ??
        item.parent ??
        this.manager.scenegraph.getViewportNode();

      const targetX = newBoundingBoxX + item.offsetFromBoundingBox[0];
      const targetY = newBoundingBoxY + item.offsetFromBoundingBox[1];

      // NOTE(sedivy): When moving nodes ina group, don't reparent the nodes to be group siblings.
      if (
        item.parent?.type === "group" &&
        item.parent?.parent === targetParent
      ) {
        targetParent = item.parent;
      }

      if (node.parent !== targetParent) {
        if (node.parent) {
          modifiedTargets.add(node.parent);
        }

        modifiedTargets.add(targetParent);

        block.changeParent(
          node,
          targetParent,
          targetParent === item.parent ? item.originalIndex : undefined,
        );
      }

      const newLocalPosition = node.toLocalPointFromParent(targetX, targetY);

      block.update(node, {
        x: newLocalPosition.x,
        y: newLocalPosition.y,
      });
    }

    // NOTE(sedivy): Animate all siblings that are affected by layout changes.
    this.manager.animateLayoutChange(modifiedTargets, this.nodeSet);

    this.manager.scenegraph.commitBlock(block, { undo: false });
  }

  onPointerUp(): void {
    this.manager.stateManager.transitionTo(new IdleState(this.manager));
  }

  render(_renderer: SkiaRenderer, canvas: Canvas): void {
    const container = this.deferredDropNode;
    if (!container) {
      return;
    }

    const paint = new Skia.Paint();
    paint.setColor(COLORS.LIGHT_BLUE);
    paint.setAntiAlias(true);
    paint.setStyle(Skia.PaintStyle.Stroke);

    const zoom = this.manager.camera.zoom;
    const outlineThickness = 3 / zoom;
    const dividerThickness = 2 / zoom;

    const bounds = container.getWorldBounds();

    // NOTE(sedivy): Draw outline around the container.
    paint.setStrokeWidth(outlineThickness);
    canvas.drawRect4f(
      bounds.x - outlineThickness / 2,
      bounds.y - outlineThickness / 2,
      bounds.x + bounds.width + outlineThickness / 2,
      bounds.y + bounds.height + outlineThickness / 2,
      paint,
    );

    // NOTE(sedivy): Draw a divider line showing where the nodes will be inserted.
    const children = container.children;
    const index = this.deferredDropChildIndex;
    if (index != null && index >= 0 && index <= children.length) {
      const isHorizontal = container.layout.direction === Axis.Horizontal;

      // NOTE(sedivy): Only draw the divider if there is something to divide.
      if (children.length) {
        const getStart = (b: ReadOnlyBounds) => (isHorizontal ? b.left : b.top);
        const getEnd = (b: ReadOnlyBounds) =>
          isHorizontal ? b.right : b.bottom;

        let start: number;
        let end: number;

        if (index === 0) {
          // NOTE(sedivy): Inserting at the start.
          start = getStart(bounds);
          end = getStart(children[0].getWorldBounds());
        } else if (index >= children.length) {
          // NOTE(sedivy): Inserting at the end.
          start = getEnd(children[children.length - 1].getWorldBounds());
          end = getEnd(bounds);
        } else {
          // NOTE(sedivy): Inserting between two children.
          start = getEnd(children[index - 1].getWorldBounds());
          end = getStart(children[index].getWorldBounds());
        }

        const linePos = (start + end) / 2;

        paint.setStrokeWidth(dividerThickness);
        const effect = Skia.PathEffect.MakeDash([8 / zoom, 8 / zoom]);
        paint.setPathEffect(effect);
        effect.delete();

        if (isHorizontal) {
          canvas.drawRect4f(linePos, bounds.top, linePos, bounds.bottom, paint);
        } else {
          canvas.drawRect4f(bounds.left, linePos, bounds.right, linePos, paint);
        }
      }
    }

    paint.delete();
  }

  onPointerDown(): void {}
  onKeyDown?(): void {}
  onKeyUp?(): void {}
  onToolChange?(): void {}

  private findDropFrame(
    worldX: number,
    worldY: number,
    width: number,
    height: number,
    allowAnySize: boolean,
  ): SceneNode | undefined {
    let node = this.manager.selectionManager.findFrameForPosition(
      worldX,
      worldY,
      undefined,
      this.nodeSet,
    );

    while (node && !node.canAcceptChildren(this.nodeSet)) {
      node = node.parent;
    }

    if (!node) {
      return;
    }

    // NOTE(sedivy): Top level frames or if we allow any size we can just return
    // the first frame we find.
    if (allowAnySize || node.parent?.root) {
      return node;
    }

    // NOTE(sedivy): We have to check every frame and parent frames to find
    // the first suitable frame that's large enough to fit the bounding box.
    while (node && !node.root) {
      if (node.type === "frame") {
        const frameBounds = node.localBounds();

        if (
          frameBounds.width >= width &&
          frameBounds.height >= height &&
          node.canAcceptChildren(this.nodeSet)
        ) {
          return node;
        }
      }
      node = node.parent;
    }
  }
}
