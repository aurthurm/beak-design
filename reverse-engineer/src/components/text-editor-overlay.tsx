import { Matrix } from "pixi.js";
import Quill from "quill";
import type React from "react";
import { useEffect, useRef } from "react";
import { useSceneManager } from "../pages/Editor";

import {
  type SceneNode,
  type ObjectUpdateBlock,
  type SceneManager,
  TextNode,
  StickyNode,
} from "@ha/pencil-editor";

class Editor {
  private sceneManager: SceneManager;
  private element: HTMLElement;
  private node: SceneNode;
  private quill: Quill;

  private active: boolean = true;

  private originalUndoSnapshot: ObjectUpdateBlock;

  constructor(
    sceneManager: SceneManager,
    container: HTMLElement,
    node: SceneNode,
  ) {
    this.sceneManager = sceneManager;
    this.node = node;

    if (node instanceof TextNode || node instanceof StickyNode) {
      node.hideText();
    }

    this.element = document.createElement("div");

    this.quill = new Quill(this.element, {
      modules: {
        toolbar: false,
      },
      formats: ["text"],
    });
    this.quill.root.style.outline = "none";

    this.setInitialStyle();

    container.appendChild(this.element);

    this.originalUndoSnapshot = this.sceneManager.scenegraph.beginUpdate();
    this.originalUndoSnapshot.snapshotProperties(node, ["textContent"]);

    const text = node.properties.resolved.textContent ?? "";
    this.quill.setText(text, "api");
    this.quill.setSelection(0, text.length);
    this.quill.history.clear();

    this.updateSize();

    // NOTE(sedivy): Disable auto-translate popups
    this.quill.root.classList.add("notranslate");
    this.quill.root.setAttribute("translate", "no");

    this.quill.on("text-change", () => {
      let text = this.quill.getText();
      if (text[text.length - 1] === "\n") {
        text = text.slice(0, text.length - 1);
      }

      const block = sceneManager.scenegraph.beginUpdate();

      block.update(node, {
        textContent: text,
      });

      sceneManager.scenegraph.commitBlock(block, { undo: false });

      this.updateSize();
    });

    this.quill.root.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.stopPropagation();
        this.destroy();
      }

      if (e.key === "Escape") {
        e.stopPropagation();
        this.destroy();
      }
    });

    this.element.addEventListener("wheel", (e) => {
      e.preventDefault();
    });

    sceneManager.eventEmitter.on("afterUpdate", this.handleViewportChange);

    requestAnimationFrame(() => {
      // NOTE(sedivy): Make sure the editor is still valid after the animation frame.
      if (this.element.parentElement) {
        document.addEventListener("mousedown", this.handleClickOutside);
        this.quill.focus();
      }
    });
  }

  handleClickOutside = (e: MouseEvent) => {
    if (!this.element.contains(e.target as Node)) {
      this.destroy();
    }
  };

  handleViewportChange = () => {
    this.updateSize();
  };

  destroy() {
    if (!this.active) {
      return;
    }

    this.active = false;

    this.sceneManager.textEditorManager.finishTextEditing();

    this.element.parentElement?.removeChild(this.element);
    document.removeEventListener("mousedown", this.handleClickOutside);
    this.sceneManager.eventEmitter.off(
      "afterUpdate",
      this.handleViewportChange,
    );

    if (this.node instanceof TextNode || this.node instanceof StickyNode) {
      this.node.showText();
    }

    // NOTE(sedivy): Remove blank text nodes after existing the editor.
    if (this.node instanceof TextNode && this.node.isEmpty()) {
      this.originalUndoSnapshot.deleteNode(this.node);
    }

    this.sceneManager.scenegraph.commitBlock(this.originalUndoSnapshot, {
      undo: true,
    });
  }

  private setInitialStyle() {
    const container = this.element;

    container.style.position = "absolute";
    container.style.transformOrigin = "top left";
    (container.style as any).webkitFontSmoothing = "antialiased";
    container.style.height = "auto";
    container.style.overflowWrap = "break-word";
    container.style.whiteSpace = "pre-wrap";
    container.style.display = "inline-block";
    container.style.border = "none";
    container.style.outline = "none";
    container.style.boxShadow = "none";
    container.style.textAlign = "left";
    container.style.fontWeight = "normal";
    container.style.background = "none";
    container.style.wordBreak = "keep-all";
    container.style.fontOpticalSizing = "none";
    container.style.fontKerning = "normal";
    container.style.pointerEvents = "auto";
    container.style.cursor = "text";

    this.quill.root.style.display = "flex";
    this.quill.root.style.flexDirection = "column";
  }

  private updateSize() {
    const node = this.node;

    let info = null;

    if (node instanceof TextNode) {
      info = node.getTextAreaInfo(this.sceneManager.skiaRenderer);
    } else if (node instanceof StickyNode) {
      info = node.getTextAreaInfo(this.sceneManager.skiaRenderer);
    } else {
      throw new Error("Unsupported node type for the editor");
    }

    if (!info) {
      this.destroy();
      return;
    }

    const matrix = new Matrix();
    matrix.append(this.sceneManager.camera.worldTransform);
    matrix.append(node.getWorldMatrix());

    this.element.style.transform = `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.tx}, ${matrix.ty}) translate(${info.bounds.minX}px, ${info.bounds.minY}px)`;

    this.quill.root.style.width = `${Math.ceil(info.bounds.width)}px`;
    this.quill.root.style.height = `${Math.ceil(info.bounds.height)}px`;

    this.quill.root.style.minWidth = !node.properties.resolved.textContent
      ? "1px"
      : "auto";

    Object.assign(this.quill.root.style, info.style);
  }
}

const TextEditorOverlay: React.FC = () => {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor>(null);
  const sceneManager = useSceneManager();

  useEffect(() => {
    function handleStartEdit(node: SceneNode) {
      if (editor.current) {
        editor.current.destroy();
        editor.current = null;
      }

      if (container.current) {
        editor.current = new Editor(sceneManager, container.current, node);
      }
    }

    function handleFinishEdit() {
      if (editor.current) {
        editor.current.destroy();
      }
    }

    sceneManager.eventEmitter.on("finishTextEdit", handleFinishEdit);
    sceneManager.eventEmitter.on("startTextEdit", handleStartEdit);

    return () => {
      sceneManager.eventEmitter.off("finishTextEdit", handleFinishEdit);
      sceneManager.eventEmitter.off("startTextEdit", handleStartEdit);
    };
  }, [sceneManager]);

  return (
    <div
      data-pencil-canvas-text-editor
      className="absolute inset-0 pointer-events-none"
    >
      {/* NOTE(sedivy): The fixed container is required to fix a bug where editing text offscreen would scroll the entire page. */}
      <div className="fixed" ref={container} />
    </div>
  );
};

export default TextEditorOverlay;
