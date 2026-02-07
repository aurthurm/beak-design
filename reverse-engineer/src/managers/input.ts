import {
  Axis,
  clamp,
  createNodeProperties,
  NodeUtils,
  ReorderAction,
  type SceneManager,
} from "@ha/pencil-editor";
import path from "path";
import type { PointData } from "pixi.js";
import React from "react";
import { toast } from "sonner";
import { KeyboardShortcuts } from "../components/keyboard-shortcuts";
import { importFiles } from "../importer";
import { globalEventEmitter } from "../lib/global-event-emitter";

class Mouse {
  window: { x: number; y: number } = { x: 0, y: 0 };
  canvas: { x: number; y: number } = { x: 0, y: 0 };
  pointerDown: boolean = false;
}

export interface Input {
  get mouse(): Mouse;
  get worldMouse(): PointData;
  get pressedKeys(): Set<string>;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

export class WebInput implements Input {
  public manager: SceneManager;
  private activeMouseDownEvents: Set<number> = new Set();
  private enabled: boolean = true;
  private containerElement: HTMLElement;
  private _mouse: Mouse = new Mouse();
  private _pressedKeys: Set<string> = new Set();

  constructor(manager: SceneManager, containerElement: HTMLElement) {
    this.manager = manager;
    this.containerElement = containerElement;

    window.addEventListener("keydown", this.handleKeydown, { capture: true });
    window.addEventListener("keyup", this.handleKeyup);

    window.addEventListener("wheel", this.handleWindowWheel, {
      passive: false,
    });
    this.containerElement.addEventListener("wheel", this.handleContainerWheel, {
      passive: false,
    });

    window.addEventListener("copy", this.handleCopy);
    window.addEventListener("cut", this.handleCut);
    window.addEventListener("paste", this.handlePaste);

    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointermove", this.handlePointerMove);
    this.containerElement.addEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    window.addEventListener("blur", this.handleWindowBlur);
    window.addEventListener("contextmenu", this.handleContextMenuEvent);

    this.containerElement.addEventListener("drop", this.handleDrop);
    this.containerElement.addEventListener("dragover", this.handleDragOver);
    this.containerElement.addEventListener("dragleave", this.handleDragLeave);
    this.containerElement.addEventListener("dragend", this.handleDragEnd);
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeydown);
    window.removeEventListener("keyup", this.handleKeyup);

    window.removeEventListener("wheel", this.handleWindowWheel);
    this.containerElement.removeEventListener(
      "wheel",
      this.handleContainerWheel,
    );

    window.removeEventListener("copy", this.handleCopy);
    window.removeEventListener("cut", this.handleCut);
    window.removeEventListener("paste", this.handlePaste);

    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointermove", this.handlePointerMove);
    this.containerElement.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    window.removeEventListener("blur", this.handleWindowBlur);
    window.removeEventListener("contextmenu", this.handleContextMenuEvent);

    this.containerElement.removeEventListener("drop", this.handleDrop);
    this.containerElement.removeEventListener("dragover", this.handleDragOver);
    this.containerElement.removeEventListener(
      "dragleave",
      this.handleDragLeave,
    );
    this.containerElement.removeEventListener("dragend", this.handleDragEnd);
  }

  handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    this.updateMousePosition(e);
  };

  handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  handleDragEnd = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    this.updateMousePosition(e);
  };

  handleDrop = (e: DragEvent) => {
    // Skip importing .pen files, handled in Editor.
    if (e.dataTransfer?.files) {
      for (const file of e.dataTransfer.files) {
        if (path.extname(file.name) === ".pen") {
          return;
        }
      }
    }

    e.preventDefault();
    e.stopPropagation();

    this.updateMousePosition(e);

    if (!this.enabled) {
      return;
    }

    importFiles(
      this.manager,
      e.dataTransfer?.files ?? null,
      e.dataTransfer?.items ?? null,
      this.worldMouse.x,
      this.worldMouse.y,
    );
  };

  handleContextMenuEvent = () => {
    this.reset();
  };

  handlePointerMove = (e: PointerEvent) => {
    this.updateMousePosition(e);

    if (!this.isEnabled()) return;

    const events = e.getCoalescedEvents();
    for (const event of events) {
      this.manager.stateManager.handlePointerMove(event);
    }
  };

  handlePointerDown = (e: PointerEvent) => {
    this.updateMousePosition(e);

    if (!this.isEnabled()) return;

    if (
      e.target instanceof Element &&
      e.target.closest("[data-pencil-canvas-text-editor]")
    ) {
      return;
    }

    // NOTE(sedivy): Remove focus on any <input> elements to call their blur
    // events. For example the properties panel commits the changes on blur, but
    // if we don't blur immediately then the selection could change inside the
    // mouse down event, which would make the blur event use the wrong nodes.
    //
    // Not sure if this is the right solution. What happens if there is a TextArea
    // or any other contentediable text that should also be blurred?
    //
    // One thing we need to be careful is text editing on the canvas. In that
    // case we don't want to loose focus.
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      document.activeElement.blur();
    }

    this.containerElement.setPointerCapture(e.pointerId);

    this._mouse.pointerDown = true;

    this.activeMouseDownEvents.add(e.pointerId);

    this.manager.stateManager.handlePointerDown(e);
  };

  handlePointerUp = (e: PointerEvent) => {
    this.updateMousePosition(e);

    this.containerElement.releasePointerCapture(e.pointerId);
    this._mouse.pointerDown = false;

    if (!this.activeMouseDownEvents.has(e.pointerId)) {
      return;
    }

    this.activeMouseDownEvents.clear();

    if (!this.isEnabled()) return;

    this.manager.stateManager.handlePointerUp(e);
  };

  private isClipboardEventAllowed(): boolean {
    const element = document.activeElement;

    // Support copy from the chat panel
    const selection = window.getSelection();
    if (selection && selection.anchorNode) {
      const selectionElement = selection.anchorNode.parentElement;
      if (selectionElement?.closest("[data-pencil-allow-chat-clipboard]")) {
        return false;
      }
    }

    if (element instanceof Element) {
      if (element.nodeName === "INPUT" || element.nodeName === "TEXTAREA") {
        return false;
      }
    }

    return Boolean(
      element instanceof Element &&
        (element.nodeName === "BODY" ||
          element.closest("[data-pencil-allow-canvas-clipboard]")),
    );
  }

  handleCopy = (e: ClipboardEvent) => {
    if (this.isClipboardEventAllowed()) {
      this.manager.selectionManager.handleCopy(e);
    }
  };

  handleCut = (e: ClipboardEvent) => {
    if (this.isClipboardEventAllowed()) {
      this.manager.selectionManager.handleCut(e);
    }
  };

  handlePaste = (e: ClipboardEvent) => {
    if (this.isClipboardEventAllowed()) {
      this.manager.selectionManager.handlePaste(e);
    }
  };

  handleWindowWheel = (e: WheelEvent) => {
    this.updateMousePosition(e);

    // NOTE(sedivy): Prevent pinch to zoom regardless of the element. We never
    // want to accidentally browser zoom into a part of the UI.
    if (e.ctrlKey) {
      e.preventDefault();
    }
  };

  handleContainerWheel = (e: WheelEvent) => {
    this.updateMousePosition(e);

    e.preventDefault();

    if (!this.isEnabled()) return;

    const mouse = this.worldMouse;

    const isPinch = e.ctrlKey;
    const isCmdZooming = e.metaKey;

    if (isPinch || isCmdZooming || this.manager.config.data.scrollWheelZoom) {
      const limit = isCmdZooming ? 15 : 30;

      const direction =
        (isCmdZooming || this.manager.config.data.scrollWheelZoom) &&
        this.manager.config.data.invertZoomDirection
          ? -1
          : 1;

      const zoomDelta = clamp(-limit, e.deltaY, limit) * -0.012 * direction;

      this.manager.camera.zoomTowardsPoint(
        mouse.x,
        mouse.y,
        this.manager.camera.zoom + zoomDelta * this.manager.camera.zoom,
      );
    } else {
      // Panning
      const deltaX = e.deltaX / this.manager.camera.zoom;
      const deltaY = e.deltaY / this.manager.camera.zoom;

      this.manager.camera.translate(deltaX, deltaY);
    }
  };

  handleWindowBlur = () => {
    this.reset();
  };

  reset() {
    this._pressedKeys.clear();

    this.manager.stateManager.handleWindowBlur();
  }

  handleKeydown = (e: KeyboardEvent) => {
    // NOTE(sedivy): Always prevent browser built-in zoom in and zoom out shortcuts
    // TODO(sedivy): This should probably happen as early as possible in the in the
    // page loading. We want to prevent browser zoom even before we load the document.
    if ((e.key === "-" || e.key === "=") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!this.isEnabled()) return;

    const meta = e.metaKey || e.ctrlKey;

    // save
    if (e.key === "s" && !e.shiftKey && meta && !e.altKey) {
      e.preventDefault();
      this.manager.saveDocument();
    }

    if (
      document.activeElement instanceof Node &&
      (document.activeElement.nodeName === "INPUT" ||
        document.activeElement.nodeName === "TEXTAREA" ||
        document.activeElement.getAttribute("contenteditable") === "true" ||
        document.activeElement.getAttribute("role") === "option")
    ) {
      return;
    }

    this._pressedKeys.add(e.code);

    this.manager.stateManager.handleKeydown(e);

    // convert to component
    if (e.code === "KeyK" && meta && e.altKey) {
      let skippedNodes = false;
      const block = this.manager.scenegraph.beginUpdate();
      for (const node of this.manager.selectionManager.selectedNodes) {
        if (node.prototype && node.id === node.prototype.node.id) {
          skippedNodes = true;
          continue;
        }
        node.setReusable(block.rollback, !node.reusable); // TODO(zaza): trigger hover/selection border redraw
      }
      this.manager.scenegraph.commitBlock(block, { undo: true });
      this.manager.selectionManager.updateMultiSelectGuides();
      this.manager.scenegraph.documentModified();

      if (skippedNodes) {
        toast.error(
          "Objects inside a component instance cannot be used as components!",
        );
      }
    }

    // detach component instance
    if (e.code === "KeyX" && meta && e.altKey) {
      const block = this.manager.scenegraph.beginUpdate();
      for (const node of this.manager.selectionManager.selectedNodes) {
        if (node.prototype && node.id !== node.prototype.node.id) {
          node.ensurePrototypeReusability(block.rollback, 1);
        }
      }
      this.manager.scenegraph.commitBlock(block, { undo: true });
      this.manager.selectionManager.updateMultiSelectGuides();
      this.manager.scenegraph.documentModified();
    }

    // replace inside instance
    if (e.code === "KeyR" && meta && e.altKey && e.shiftKey) {
      const nodes = this.manager.selectionManager.selectedNodes;
      if (nodes.size === 2) {
        const replacementNode = nodes
          .values()
          .find((node) => node.parent!.prototype === undefined);
        const replacedNode = nodes
          .values()
          .find((node) => node.parent!.prototype !== undefined);
        if (replacementNode && replacedNode) {
          const block = this.manager.scenegraph.beginUpdate();
          const parent = replacedNode.parent!;
          const index = parent.childIndex(replacedNode);
          const { x, y } = replacedNode.getTransformedLocalBounds();
          block.deleteNode(replacedNode);
          block.changeParent(replacementNode, parent, index, true);
          block.snapshotProperties(replacementNode, ["x", "y"]);
          replacementNode.layoutCommitPosition(x, y);
          this.manager.scenegraph.commitBlock(block, { undo: true });
          this.manager.selectionManager.updateMultiSelectGuides();
          this.manager.scenegraph.documentModified();
        }
      } else if (nodes.size === 1) {
        const node = [...nodes][0];
        if (node.prototype) {
          const block = this.manager.scenegraph.beginUpdate();
          if (node.prototype.childrenOverridden) {
            block.restoreInstanceChildren(node);
          } else {
            block.clearChildren(node);
          }
          this.manager.scenegraph.commitBlock(block, { undo: true });
        }
      }
    }

    // zoom-in
    if (e.key === "=" && !e.altKey) {
      e.preventDefault();
      this.manager.camera.setZoom(this.manager.camera.zoom * 2, true);
    }

    // zoom-out
    if (e.key === "-" && !e.altKey) {
      e.preventDefault();
      this.manager.camera.setZoom(this.manager.camera.zoom / 2, true);
    }

    // zoom reset
    if (e.key === "0" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      this.manager.camera.setZoom(1, true);
    }

    // zoom fit
    if (e.key === "1" && !meta && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const bounds = this.manager.scenegraph.getDocumentBoundingBox();
      if (bounds) {
        this.manager.camera.zoomToBounds(bounds, 40);
      }
    }

    // zoom selection
    if (e.key === "2" && !meta && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const bounds = this.manager.selectionManager.getWorldspaceBounds();
      if (bounds) {
        this.manager.camera.zoomToBounds(bounds, 40);
      }
    }

    // select parent node with Shift+Enter
    if (e.key === "Enter" && e.shiftKey && !meta && !e.altKey) {
      e.preventDefault();
      const newNodes = new Set(this.manager.selectionManager.selectedNodes);

      for (const node of this.manager.selectionManager.selectedNodes) {
        const parent = node.parent;
        if (parent && !parent.root) {
          newNodes.add(parent);
          newNodes.delete(node);
        }
      }

      this.manager.selectionManager.setSelection(newNodes);
    }

    // Enter (enter text edit mode or select children)
    if (e.key === "Enter" && !e.shiftKey && !meta && !e.altKey) {
      e.preventDefault();

      const node = this.manager.selectionManager.getSingleSelectedNode();
      if (
        node &&
        (node.type === "text" ||
          node.type === "note" ||
          node.type === "prompt" ||
          node.type === "context")
      ) {
        this.manager.textEditorManager.startTextEditing(node);
      } else {
        const newNodes = new Set(this.manager.selectionManager.selectedNodes);

        for (const node of this.manager.selectionManager.selectedNodes) {
          if (node.children.length) {
            for (const child of node.children) {
              newNodes.add(child);
            }
            newNodes.delete(node);
          }
        }

        this.manager.selectionManager.setSelection(newNodes);
      }
    }

    // group
    if (e.key === "g" && !e.shiftKey && meta && !e.altKey) {
      e.preventDefault();

      const block = this.manager.scenegraph.beginUpdate();

      const nodes = this.manager.selectionManager.selectedNodes;
      if (nodes.size > 1) {
        const group = this.manager.scenegraph.createGroup(
          block,
          Array.from(nodes),
        );
        if (group) {
          this.manager.selectionManager.selectNode(group);
        }
      }

      this.manager.scenegraph.commitBlock(block, { undo: true });
    }

    // frame
    if (e.code === "KeyG" && !e.shiftKey && meta && e.altKey) {
      e.preventDefault();

      const nodes = this.manager.selectionManager.selectedNodes;
      if (nodes.size > 0) {
        const frameParent =
          nodes.values().next().value?.parent ??
          this.manager.scenegraph.getViewportNode();

        const bounds = NodeUtils.calculateCombinedBoundsNew(nodes);
        if (bounds) {
          const block = this.manager.scenegraph.beginUpdate();

          const framePosition = frameParent.toLocal(bounds.left, bounds.top);

          const frame = this.manager.scenegraph.createAndInsertNode(
            block,
            undefined,
            "frame",
            createNodeProperties("frame", {
              x: framePosition.x,
              y: framePosition.y,
              width: bounds.width,
              height: bounds.height,
              name: `Frame ${this.manager.scenegraph.getNextFrameNumber()}`,
            }),
            frameParent,
          );

          for (const node of nodes) {
            const position = node.getGlobalPosition();

            block.changeParent(node, frame);

            const local = node.toLocalPointFromParent(position.x, position.y);
            block.update(node, {
              x: local.y,
              y: local.y,
            });
          }

          this.manager.scenegraph.commitBlock(block, { undo: true });
          this.manager.selectionManager.selectNode(frame);
        }
      }
    }

    // select all
    if (e.key === "a" && !e.shiftKey && meta && !e.altKey) {
      e.stopPropagation();
      e.preventDefault();

      if (this.manager.selectionManager.selectedNodes.size === 0) {
        this.manager.selectionManager.setSelection(
          new Set(this.manager.scenegraph.getViewportNode().children),
        );
      } else {
        let commonParent = null;

        for (const node of this.manager.selectionManager.selectedNodes) {
          if (commonParent == null) {
            commonParent = node.parent;
          } else if (node.parent !== commonParent) {
            commonParent = null;
            break;
          }
        }

        if (commonParent) {
          this.manager.selectionManager.setSelection(
            new Set(commonParent.children),
          );
        }
      }
    }

    // bring to front
    if (e.key === "]" && !e.shiftKey && !meta && !e.altKey) {
      e.preventDefault();

      const block = this.manager.scenegraph.beginUpdate();

      this.manager.scenegraph.reorderNodesInParents(
        block,
        this.manager.selectionManager.selectedNodes,
        ReorderAction.BringToFront,
      );

      this.manager.scenegraph.commitBlock(block, { undo: true });
    }

    // send to back
    if (e.key === "[" && !e.shiftKey && !meta && !e.altKey) {
      e.preventDefault();

      const block = this.manager.scenegraph.beginUpdate();

      this.manager.scenegraph.reorderNodesInParents(
        block,
        this.manager.selectionManager.selectedNodes,
        ReorderAction.SendToBack,
      );

      this.manager.scenegraph.commitBlock(block, { undo: true });
    }

    // send backward
    if (e.key === "[" && !e.shiftKey && meta && !e.altKey) {
      e.preventDefault();

      const block = this.manager.scenegraph.beginUpdate();

      this.manager.scenegraph.reorderNodesInParents(
        block,
        this.manager.selectionManager.selectedNodes,
        ReorderAction.SendBackward,
      );

      this.manager.scenegraph.commitBlock(block, { undo: true });
    }

    // bring forward
    if (e.key === "]" && !e.shiftKey && meta && !e.altKey) {
      e.preventDefault();

      const block = this.manager.scenegraph.beginUpdate();

      this.manager.scenegraph.reorderNodesInParents(
        block,
        this.manager.selectionManager.selectedNodes,
        ReorderAction.BringForward,
      );

      this.manager.scenegraph.commitBlock(block, { undo: true });
    }

    // undo
    if (e.key === "z" && !e.shiftKey && meta && !e.altKey) {
      e.stopPropagation();
      this.manager.undoManager.undo();
    }

    // redo
    if (e.key === "z" && e.shiftKey && meta && !e.altKey) {
      e.stopPropagation();
      this.manager.undoManager.redo();
    }

    // ungroup
    if (e.key === "g" && e.shiftKey && meta && !e.altKey) {
      e.preventDefault();

      const nodes = this.manager.selectionManager.selectedNodes;
      const selection = new Set(nodes);

      const block = this.manager.scenegraph.beginUpdate();

      for (const node of nodes) {
        if (node.type === "group" || node.type === "frame") {
          const newParent =
            node.parent ?? this.manager.scenegraph.getViewportNode();

          selection.delete(node);
          for (let i = node.children.length - 1; i >= 0; i--) {
            const child = node.children[i];

            const position = child.getGlobalPosition();
            const local = newParent.toLocal(position.x, position.y);

            block.changeParent(child, newParent);
            block.update(child, {
              x: local.x,
              y: local.y,
            });

            selection.add(child);
          }

          block.deleteNode(node);
        }
      }

      this.manager.scenegraph.commitBlock(block, { undo: true });

      this.manager.selectionManager.setSelection(selection);
    }

    // toggle snap to pixel grid
    if (e.key === "'" && e.shiftKey && meta && !e.altKey) {
      this.manager.config.set(
        "roundToPixels",
        !this.manager.config.data.roundToPixels,
      );

      toast.info(
        `Snap to pixel grid ${this.manager.config.data.roundToPixels ? "enabled" : "disabled"}`,
      );
    }

    // toggle pixel grid rendering
    if (e.key === "'" && !e.shiftKey && meta && !e.altKey) {
      this.manager.config.set(
        "showPixelGrid",
        !this.manager.config.data.showPixelGrid,
      );
      this.manager.requestFrame();

      toast.info(
        `Pixel grid ${this.manager.config.data.showPixelGrid ? "visible" : "hidden"}`,
      );
    }

    // duplicate selection
    if (e.key === "d" && !e.shiftKey && meta && !e.altKey) {
      e.preventDefault();
      this.manager.selectionManager.duplicateSelectedNodes();
    }

    // delete selection
    if (
      (e.key === "Backspace" || e.key === "Delete") &&
      !e.shiftKey &&
      !meta &&
      !e.altKey
    ) {
      e.preventDefault();
      this.manager.selectionManager.removeSelectedNodes();
    }

    // clear selection
    if (e.key === "Escape" && !e.shiftKey && !meta && !e.altKey) {
      e.preventDefault();
      this.manager.selectionManager.clearSelection();
    }

    if (e.key === "v" && !e.shiftKey && !meta && !e.altKey) {
      this.manager.setActiveTool("move");
    }

    if (e.key === "h" && !e.shiftKey && !meta && !e.altKey) {
      this.manager.setActiveTool("hand");
    }

    if (e.key === "r" && !e.shiftKey && !meta && !e.altKey) {
      this.manager.setActiveTool("rectangle");
    }

    if (e.key === "o" && !e.shiftKey && !meta && !e.altKey) {
      this.manager.setActiveTool("ellipse");
    }

    if ((e.key === "a" || e.key === "f") && !e.shiftKey && !meta && !e.altKey) {
      this.manager.setActiveTool("frame");
    }

    if (e.key === "t" && !e.shiftKey && !meta && !e.altKey) {
      this.manager.setActiveTool("text");
    }

    if (e.key === "n" && !e.shiftKey && !meta && !e.altKey) {
      this.manager.setActiveTool("sticky_note");
    }

    if (e.key === "?" && !meta && !e.altKey) {
      e.preventDefault();

      globalEventEmitter.emit(
        "openModal",
        React.createElement(KeyboardShortcuts),
      );
    }

    // Arrow keys to pixel move selection
    if (
      (e.code === "ArrowLeft" ||
        e.code === "ArrowUp" ||
        e.code === "ArrowRight" ||
        e.code === "ArrowDown") &&
      !meta
    ) {
      const block = this.manager.scenegraph.beginUpdate();

      const verticalLayout = [];
      const horizontalLayout = [];
      const pixelMove = [];

      for (const node of this.manager.selectionManager.selectedNodes) {
        if (node.isInLayout()) {
          const axis = node.parent?.layout.direction;
          if (axis === Axis.Horizontal) {
            horizontalLayout.push(node);
          } else if (axis === Axis.Vertical) {
            verticalLayout.push(node);
          }
        } else {
          pixelMove.push(node);
        }
      }

      if (pixelMove.length) {
        const offset = [0, 0];
        const distance = e.shiftKey ? 10 : 1;

        if (e.code === "ArrowLeft") {
          offset[0] = -distance;
        } else if (e.code === "ArrowUp") {
          offset[1] = -distance;
        } else if (e.code === "ArrowRight") {
          offset[0] = distance;
        } else if (e.code === "ArrowDown") {
          offset[1] = distance;
        }

        for (const node of pixelMove) {
          const position = node.getGlobalPosition();

          const target = node.toLocalPointFromParent(
            position.x + offset[0],
            position.y + offset[1],
          );

          block.update(node, {
            x: target.x,
            y: target.y,
          });
        }
      } else if (horizontalLayout.length || verticalLayout.length) {
        if (e.code === "ArrowLeft") {
          this.manager.scenegraph.reorderNodesInParents(
            block,
            horizontalLayout,
            e.altKey ? ReorderAction.SendToBack : ReorderAction.SendBackward,
          );
        } else if (e.code === "ArrowUp") {
          this.manager.scenegraph.reorderNodesInParents(
            block,
            verticalLayout,
            e.altKey ? ReorderAction.SendToBack : ReorderAction.SendBackward,
          );
        } else if (e.code === "ArrowRight") {
          this.manager.scenegraph.reorderNodesInParents(
            block,
            horizontalLayout,
            e.altKey ? ReorderAction.BringToFront : ReorderAction.BringForward,
          );
        } else if (e.code === "ArrowDown") {
          this.manager.scenegraph.reorderNodesInParents(
            block,
            verticalLayout,
            e.altKey ? ReorderAction.BringToFront : ReorderAction.BringForward,
          );
        }
      }

      this.manager.scenegraph.commitBlock(block, { undo: true });
    }
  };

  handleKeyup = (e: KeyboardEvent) => {
    this._pressedKeys.delete(e.code);

    if (!this.isEnabled()) return;

    this.manager.stateManager.handleKeyup(e);
  };

  private updateMousePosition(
    e: DragEvent | MouseEvent | PointerEvent | WheelEvent,
  ) {
    // TODO(sedivy): Don't call getBoundingClientRect but instead have a
    // cached value we get from the ResizeObserver.
    const canvasRect = this.containerElement.getBoundingClientRect();

    this._mouse.window.x = e.clientX;
    this._mouse.window.y = e.clientY;

    this._mouse.canvas.x = e.clientX - canvasRect.left;
    this._mouse.canvas.y = e.clientY - canvasRect.top;
  }

  get worldMouse(): PointData {
    return this.manager.camera.toWorld(
      this._mouse.canvas.x,
      this._mouse.canvas.y,
    );
  }

  get mouse(): Mouse {
    return this._mouse;
  }

  get pressedKeys(): Set<string> {
    return this._pressedKeys;
  }

  pagePositionToWorld(clientX: number, clientY: number) {
    const canvasRect = this.containerElement.getBoundingClientRect();

    return this.manager.camera.toWorld(
      clientX - canvasRect.left,
      clientY - canvasRect.top,
    );
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }
}
