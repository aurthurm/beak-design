import { logger } from "@ha/shared";
import path from "path-browserify";
import type { Point } from "pixi.js";
import { SceneGraph } from "../canvas";
import { NodeUtils } from "../canvas/node-utils";
import type { ObjectUpdateBlock } from "../canvas/object-update-block";
import type { SceneNode } from "../canvas/scene-node";
import {
  createClipboardDataFromNodes,
  pasteClipboardData,
  validateClipboardData,
} from "../clipboard.js";
import { parseFigma } from "../import/figma/figma-importer";
import * as platform from "../platform";
import type { ReadOnlyBounds } from "../utils/bounds";
import type { SceneManager } from "./scene-manager";

export type SelectionChangeCallback = (nodes: Set<SceneNode>) => void;

export class SelectionManager {
  private sm: SceneManager;
  selectedNodes: Set<SceneNode> = new Set();
  private onSelectionChange?: SelectionChangeCallback;

  // === Clipboard State ===
  public readonly clipboardSourceId = crypto.randomUUID();

  // === Hover State ===
  public hoveredNode: SceneNode | null = null;

  // === Double-click Detection State ===
  public lastClickTime: number = 0;
  public lastClickTargetId: string | null = null;
  public doubleClickThreshold: number = 300;

  // === Moving State for Reparenting ===
  public dragStartNodeParents: Map<string, string | null> = new Map();

  constructor(sm: SceneManager) {
    this.sm = sm;
  }

  public setHoveredNode(node: SceneNode | null): void {
    this.hoveredNode = node;
  }

  // === Double-click Detection Methods ===
  public getLastClickTime(): number {
    return this.lastClickTime;
  }

  public setLastClickTime(time: number): void {
    this.lastClickTime = time;
  }

  public getLastClickTargetId(): string | null {
    return this.lastClickTargetId;
  }

  public setLastClickTargetId(id: string | null): void {
    this.lastClickTargetId = id;
  }

  public getDoubleClickThreshold(): number {
    return this.doubleClickThreshold;
  }

  public handleCopy(e: ClipboardEvent) {
    const data = createClipboardDataFromNodes(
      this.selectedNodes.values(),
      this.sm.fileManager,
      this.sm.variableManager,
      this.clipboardSourceId,
    );

    e.clipboardData?.clearData();
    e.clipboardData?.setData("application/x-ha", JSON.stringify(data));

    // NOTE(sedivy): When copying nodes on the canvas, include special Cursor
    // metadata so when pasted in the chat it will include all selected IDs
    // hidden in the mention element.
    if (platform.appName === "Cursor") {
      const nodes = Array.from(this.selectedNodes);
      if (nodes.length > 0) {
        const filePath = this.sm.scenegraph.documentPath;

        // NOTE(sediv): This text will not be visible in the chat, it will only
        // be used in the LLM context.
        let context = "Use Pencil mcp tools.";
        if (filePath) {
          context += `Current file ${filePath}.`;
        }
        context += `Selected node ids: ${nodes.map((item) => item.id).join(", ")}`;

        const mentionPath = filePath ? path.basename(filePath) : "Pencil";
        const mentionDetail =
          nodes.length === 1 && nodes[0].properties.resolved.name
            ? `${nodes[0].properties.resolved.name}`
            : `${nodes.length} layer${nodes.length > 1 ? "s" : ""}`;

        // NOTE(sedivy): This is the internal Cursor data structure to control
        // the @ mention elements in the chat window.
        //
        // To get the latest structure you need to first create the mentions in
        // the chat in some way (typing @ and selecting the element or using the
        // Browser tab selection feature). Once you have the elements you want
        // to replicate, select all (cmd+a) and copy (cmd+c) in the chat and paste
        // the clipboard into some clipboard inspector tool, for example:
        // https://evercoder.github.io/clipboard-inspector/
        e.clipboardData?.setData(
          "application/x-lexical-editor",
          JSON.stringify({
            nodes: [
              {
                detail: 0,
                format: 0,
                mode: "segmented",
                style: "",
                text: context,
                mentionName: `${mentionPath} (${mentionDetail})`,
                type: "mention",
                version: 1,
                typeaheadType: "file",
                metadata: {
                  iconClasses: [
                    "file-icon",
                    "name-file-icon",
                    "pen-ext-file-icon",
                    "ext-file-icon",
                    "pencil-lang-file-icon",
                  ],
                },
              },
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: " ",
                type: "text",
                version: 1,
              },
            ],
          }),
        );
      }
    }

    e.preventDefault();
  }

  public handleCut(e: ClipboardEvent) {
    this.handleCopy(e);
    this.removeSelectedNodes();
  }

  public handlePaste(e: ClipboardEvent) {
    let centerUnderMouseAfterPaste = false;
    const block = this.sm.scenegraph.beginUpdate();

    const parentContainer = this.sm.scenegraph.getViewportNode();

    let createdNodes: SceneNode[] = [];

    if (e.clipboardData?.types.includes("application/x-ha")) {
      const json = e.clipboardData.getData("application/x-ha");
      try {
        const clipboardData = JSON.parse(json);
        if (!validateClipboardData(clipboardData)) {
          logger.error("Invalid clipboard data structure");
        } else {
          createdNodes = pasteClipboardData(
            clipboardData,
            this.sm.scenegraph,
            this.sm.variableManager,
            parentContainer,
            block,
            this.clipboardSourceId,
          );
          centerUnderMouseAfterPaste = true;
        }
      } catch (e) {
        logger.error("Invalid application/x-ha file format during paste", e);
      }
    } else if (e.clipboardData?.types.includes("text/html")) {
      const html = e.clipboardData?.getData("text/html");
      try {
        const root = parseFigma(html);
        if (root?.children) {
          for (const child of root.children) {
            createdNodes.push(
              this.sm.scenegraph.deserializeNode(block, child, parentContainer),
            );
          }

          centerUnderMouseAfterPaste = true;
        }
      } catch (_e) {}
    }

    if (createdNodes.length > 0) {
      // NOTE(sedivy): Move the center of the bounding box to the position under
      // the cursor
      if (centerUnderMouseAfterPaste) {
        const newCenterX = this.sm.camera.centerX;
        const newCenterY = this.sm.camera.centerY;

        const bounds = NodeUtils.calculateCombinedBoundsFromArray(createdNodes);
        if (bounds) {
          const centerX = bounds.x + bounds.width / 2;
          const centerY = bounds.y + bounds.height / 2;

          for (const child of createdNodes) {
            const dx = child.properties.resolved.x - centerX;
            const dy = child.properties.resolved.y - centerY;

            // TODO(sedivy): Doing a position update after we already inserted
            // will cause unnecessary layout and position computation.
            block.update(child, {
              x: newCenterX + dx,
              y: newCenterY + dy,
            });
          }
        }
      }

      // Clear current selection and select the newly pasted nodes
      this.clearSelection(false); // Don't notify yet
      createdNodes.forEach((node) => {
        this.selectedNodes.add(node);
      });

      // Use requestAnimationFrame to ensure nodes are fully added and transformed before updating guides/notifying
      requestAnimationFrame(() => {
        this.updateMultiSelectGuides();
        this.notifySelectionChange();
        logger.debug(`Pasted and selected ${createdNodes.length} nodes.`);
      });
    } else {
      logger.warn("Paste operation resulted in no nodes being created.");
    }

    this.sm.scenegraph.commitBlock(block, { undo: true });
  }

  isInTheSelectionTree(start: SceneNode) {
    for (
      let node: SceneNode | null = start;
      node && !node.root;
      node = node.parent
    ) {
      if (this.selectedNodes.has(node)) {
        return true;
      }
    }

    return false;
  }

  getSingleSelectedNode(): SceneNode | undefined {
    if (this.selectedNodes.size === 1) {
      const [node] = this.selectedNodes;
      return node;
    }
    return undefined;
  }

  // Subscribe to selection changes via event emitter
  subscribeSelectionChange(callback: SelectionChangeCallback) {
    this.sm.eventEmitter.on("selectionChange", callback);
  }

  // Unsubscribe from selection changes
  unsubscribeSelectionChange(callback: SelectionChangeCallback) {
    this.sm.eventEmitter.off("selectionChange", callback);
  }

  // Notify about selection changes
  private notifySelectionChange() {
    this.onSelectionChange?.(this.selectedNodes);
    this.sm.eventEmitter.emit("selectionChange", this.selectedNodes);
  }

  // Main selection method
  selectNode(
    node: SceneNode,
    additive: boolean = false,
    isDirectSelect: boolean = false,
  ) {
    if (node.destroyed) {
      return;
    }

    logger.debug(
      "selectNode",
      node.path,
      node.properties.resolved.name,
      additive,
      isDirectSelect,
    );

    const isCurrentlySelected = this.selectedNodes.has(node);
    let selectionActuallyChanged = false;

    // Handle direct select: always clear previous selection first
    if (isDirectSelect) {
      // Only change selection if it's not already the single selected node
      if (this.selectedNodes.size !== 1 || !this.selectedNodes.has(node)) {
        this.clearSelection(false); // Clear selection without notifying yet
        this.selectedNodes.add(node);
        selectionActuallyChanged = true;
      }
    } else if (additive) {
      // Handle additive/subtractive selection
      if (isCurrentlySelected) {
        this.selectedNodes.delete(node);
        selectionActuallyChanged = true;
      } else {
        this.selectedNodes.add(node);
        selectionActuallyChanged = true;
      }
    } else {
      // Non-additive: if clicking unselected, or >1 selected, clear first
      if (!isCurrentlySelected || this.selectedNodes.size > 1) {
        this.clearSelection(false);
        this.selectedNodes.add(node);
        selectionActuallyChanged = true;
      } else {
        // Clicking the single selected node without shift/additive: do nothing to selection
        // selectionActuallyChanged remains false
      }
    }

    // Always update guides, but notify only if selection changed.
    // Defer the guide update slightly to allow transforms to settle.
    if (selectionActuallyChanged) {
      requestAnimationFrame(() => {
        this.updateMultiSelectGuides();
        this.notifySelectionChange();
      });
    } else {
      this.updateMultiSelectGuides();
    }
  }

  /**
   * Remove one node from the current selection.
   */
  deselectNode(node: SceneNode, notify: boolean = true): void {
    if (this.selectedNodes.delete(node)) {
      this.updateMultiSelectGuides();
      if (notify) {
        this.notifySelectionChange();
      }
    }
  }

  /**
   * Clear the whole selection map and optionally emit the change event.
   */
  clearSelection(notify: boolean = true): void {
    if (this.selectedNodes.size === 0) return;

    this.selectedNodes.clear();
    // clear guides + hover highlights
    this.sm.guidesManager.clear(); // clear guides *and* highlights
    if (notify) {
      this.notifySelectionChange();
    }
  }

  /**
   * Remove all selected nodes from the scene
   */
  removeSelectedNodes() {
    if (this.selectedNodes.size > 0) {
      const block = this.sm.scenegraph.beginUpdate();

      for (const node of this.selectedNodes.values()) {
        if (!node.isUnique) {
          // NOTE(zaza): we cannot delete non-unique nodes, but we can emulate deletion
          // by applying an `enabled: false` override (inspired by Figma's behavior).
          block.update(node, { enabled: false });
        } else if (
          node.parent?.prototype &&
          !node.parent.prototype.childrenOverridden
        ) {
          // NOTE(zaza): this node is overriding another node inside an instance.
          const block = this.sm.scenegraph.beginUpdate();
          const parent = node.parent;
          const index = parent.childIndex(node);
          block.deleteNode(node);
          this.sm.scenegraph.unsafeInsertNode(
            parent.prototype!.node.children[index].createInstancesFromSubtree(),
            parent,
            index,
            block.rollback,
            true,
            true,
          );
          this.sm.scenegraph.commitBlock(block, { undo: true });
        } else {
          block.deleteNode(node);
        }
      }

      this.sm.scenegraph.commitBlock(block, { undo: true });

      this.selectedNodes.clear();
      this.sm.guidesManager.clear(); // Clear guides and highlights after removal
      this.notifySelectionChange(); // Notify about empty selection
    }
  }

  setSelection(newNodes: Set<SceneNode>) {
    let modified = false;

    for (const node of this.selectedNodes) {
      if (!newNodes.has(node)) {
        this.selectedNodes.delete(node);
        modified = true;
      }
    }

    for (const node of newNodes) {
      if (!this.selectedNodes.has(node)) {
        this.selectedNodes.add(node);
        modified = true;
      }
    }

    if (modified) {
      this.updateMultiSelectGuides();
      this.notifySelectionChange();
    }
  }

  getWorldspaceBounds(): ReadOnlyBounds | null {
    if (this.selectedNodes.size === 0) {
      return null;
    }

    return NodeUtils.calculateCombinedBoundsNew(this.selectedNodes);
  }

  alignSelectedNodes(
    align: "top" | "middle" | "bottom" | "left" | "center" | "right",
  ): void {
    if (this.selectedNodes.size < 2) {
      return;
    }

    const combinedBounds = NodeUtils.calculateCombinedBoundsNew(
      this.selectedNodes,
    );
    if (!combinedBounds) {
      return;
    }

    const block = this.sm.scenegraph.beginUpdate();

    for (const node of this.selectedNodes.values()) {
      const nodeBounds = node.getWorldBounds();
      let target = node.getGlobalPosition();

      switch (align) {
        case "left":
          target.x += combinedBounds.x - nodeBounds.x;
          break;
        case "center":
          target.x +=
            combinedBounds.x +
            combinedBounds.width / 2 -
            (nodeBounds.x + nodeBounds.width / 2);
          break;
        case "right":
          target.x +=
            combinedBounds.x +
            combinedBounds.width -
            (nodeBounds.x + nodeBounds.width);
          break;
        case "top":
          target.y += combinedBounds.y - nodeBounds.y;
          break;
        case "middle":
          target.y +=
            combinedBounds.y +
            combinedBounds.height / 2 -
            (nodeBounds.y + nodeBounds.height / 2);
          break;
        case "bottom":
          target.y +=
            combinedBounds.y +
            combinedBounds.height -
            (nodeBounds.y + nodeBounds.height);
          break;
      }

      target = node.toLocalPointFromParent(target.x, target.y);
      block.update(node, {
        x: target.x,
        y: target.y,
      });
    }

    this.sm.scenegraph.commitBlock(block, { undo: true });
  }

  /**
   * Rotate selected nodes around a center point
   */
  rotateSelectedNodes(
    block: ObjectUpdateBlock,
    rotationDelta: number,
    center: Point,
    initialNodeRotations: Map<SceneNode, number>,
    initialNodePositions: Map<SceneNode, Point>,
  ): void {
    for (const node of this.selectedNodes) {
      const initialRotation = initialNodeRotations.get(node);
      const initialPosition = initialNodePositions.get(node);
      if (initialPosition == null || initialRotation == null) {
        continue;
      }

      const targetRotation = initialRotation + rotationDelta;

      const dx = initialPosition.x - center.x;
      const dy = initialPosition.y - center.y;

      const newDx = dx * Math.cos(rotationDelta) - dy * Math.sin(rotationDelta);
      const newDy = dx * Math.sin(rotationDelta) + dy * Math.cos(rotationDelta);

      const newX = center.x + newDx;
      const newY = center.y + newDy;

      const localPosition = node.toLocalPointFromParent(newX, newY);

      block.update(node, {
        x: localPosition.x,
        y: localPosition.y,
        rotation: targetRotation,
      });
    }
  }

  findNodeAtPosition(
    screenX: number,
    screenY: number,
    shouldDirectSelect: boolean = false,
    allowedNestedSearch: Set<SceneNode> | undefined = undefined,
    root: SceneNode | null = null,
  ): SceneNode | null {
    // NOTE(sedivy): Make sure layout is up-to-date before finding layers for a position.
    this.sm.scenegraph.updateLayout();

    root = root ?? this.sm.scenegraph.getViewportNode();

    const worldPoint = this.sm.camera.toWorld(screenX, screenY);

    for (let i = root.children.length - 1; i >= 0; i--) {
      const hit = root.children[i].pointerHitTest(
        shouldDirectSelect,
        allowedNestedSearch,
        worldPoint.x,
        worldPoint.y,
      );
      if (hit) {
        return hit;
      }
    }

    return null;
  }

  hasSelectedChildren(sceneNode: SceneNode): boolean {
    for (const child of sceneNode.children) {
      if (this.selectedNodes.has(child)) {
        return true;
      }
    }

    return false;
  }

  findFrameForPosition(
    worldX: number,
    worldY: number,
    root: SceneNode | undefined,
    ignore: Set<SceneNode> | undefined,
  ): SceneNode | null {
    root = root ?? this.sm.scenegraph.getViewportNode();

    for (let i = root.children.length - 1; i >= 0; i--) {
      const sceneNode = root.children[i];
      if (!sceneNode.properties.resolved.enabled) continue;

      if (ignore?.has(sceneNode)) {
        continue;
      }

      if (
        (sceneNode.type === "frame" || sceneNode.type === "group") &&
        sceneNode.containsPointInBoundingBox(worldX, worldY)
      ) {
        const nodeInsideFrame = this.findFrameForPosition(
          worldX,
          worldY,
          sceneNode,
          ignore,
        );
        if (nodeInsideFrame?.canAcceptChildren()) {
          return nodeInsideFrame;
        }

        if (sceneNode.type === "frame" && sceneNode.canAcceptChildren()) {
          return sceneNode;
        }
      }
    }

    return null;
  }

  updateMultiSelectGuides(hideHighlights: boolean = false) {
    this.sm.guidesManager.updateMultiSelectGuides(hideHighlights);
  }

  duplicateSelectedNodes() {
    const block = this.sm.scenegraph.beginUpdate();

    const newSelection: Set<SceneNode> = new Set();

    for (const node of this.selectedNodes) {
      if (!node.parent) {
        continue;
      }

      // NOTE(sedivy): Find the nearest parent that can accept children. We
      // could be trying to duplicate a node inside an instance.
      let targetParent: SceneNode | null = node.parent;
      while (targetParent && !targetParent.canAcceptChildren()) {
        targetParent = targetParent.parent;
      }
      if (!targetParent) {
        targetParent = this.sm.scenegraph.getViewportNode();
      }

      const copiedNode = node.createInstancesFromSubtree();
      copiedNode.id = SceneGraph.createUniqueID();
      copiedNode.ensurePrototypeReusability(block.rollback);

      // NOTE(sedivy): If we changed the parent we need to apply the same
      // world transform to keep the node visually in the same place.
      if (targetParent !== node.parent) {
        copiedNode.setWorldTransform(block, node.getWorldMatrix());
      }

      // NOTE(sedivy): If we are duplicating a single top-level frame, create
      // the duplicate to the right of the original frame.
      if (
        this.selectedNodes.size === 1 &&
        node.type === "frame" &&
        node.parent.root
      ) {
        const bounds = node.getTransformedLocalBounds();
        const { x, y } = this.sm.scenegraph.findEmptySpaceAroundNode(
          node,
          bounds.width,
          bounds.height,
          40,
          "right",
        );

        copiedNode.layoutCommitPosition(x, y);
      }

      block.addNode(
        copiedNode,
        targetParent,
        targetParent === node.parent
          ? node.parent.childIndex(node) + 1
          : undefined,
      );

      newSelection.add(copiedNode);
    }

    this.sm.scenegraph.commitBlock(block, { undo: true });

    // NOTE(sedivy): Move the camera make the duplicated nodes visible.
    this.sm.scenegraph.updateLayout();
    const bounds = NodeUtils.calculateCombinedBoundsFromArray(
      Array.from(newSelection),
    );
    if (bounds) {
      this.sm.camera.ensureVisible(bounds);
    }

    this.setSelection(newSelection);
  }
}
