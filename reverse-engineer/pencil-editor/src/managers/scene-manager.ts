import { type IPCHost, logger } from "@ha/shared";
import type { Canvas } from "@highagency/pencil-skia";
import EventEmitter from "eventemitter3";
import debounce from "lodash.debounce";
import type { Container } from "pixi.js";
import posthog from "posthog-js";
import { toast } from "sonner";
import { Camera } from "../camera";
import { GuidesGraph } from "../canvas/guides-graph";
import { SceneGraph } from "../canvas/scene-graph";
import type { SceneNode } from "../canvas/scene-node";
import { Undo } from "../canvas/undo";
import { reportError } from "../error-reporter";
import * as platform from "../platform";
import { hexToColor } from "../skia";
import type { SkiaRenderer } from "../skia-renderer";
import { SnapManager } from "../snap";
import type { Input, PencilConfig, PixiManagerAdapter } from "../types";
import type { Connection } from "../types/connections";
import { almostEquals, clamp, expDecay } from "../utils";
import type { Bounds } from "../utils/bounds";
import { AssetManager } from "./asset-manager";
import { ConnectionManager } from "./connection-manager";
import { FileManager } from "./file-manager";
import { GuidesManager } from "./guides-manager";
import { NodeManager } from "./node-manager";
import { SelectionManager } from "./selection-manager";
import {
  EditingTextState,
  IdleState,
  InteractionStateManager,
  MovingState,
} from "./state-manager";
import { TextEditorManager } from "./text-editor-manager";
import { VariableManager } from "./variable-manager";

// Polyfill for requestAnimationFrame in headless environments
const requestAnimationFrame = !platform.isHeadlessMode
  ? window.requestAnimationFrame.bind(window)
  : (callback: FrameRequestCallback) => setTimeout(callback, 1000 / 60);

export const Background = {
  dark: hexToColor("#1e1e1e"),
  light: hexToColor("#f6f6f6"),
} as const;

export type HandleType =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "t"
  | "b"
  | "l"
  | "r"
  | "rot"
  | "cr_tl"
  | "cr_tr"
  | "cr_bl"
  | "cr_br"
  | "connection";

export type Tool =
  | "move"
  | "rectangle"
  | "ellipse"
  | "frame"
  | "text"
  | "line"
  | "polygon"
  | "icon"
  | "image"
  | "sticky_note"
  | "icon_font"
  | "hand";

export type PropertyChangeCallback = (node: SceneNode) => void;
export type ToolChangeCallback = (tool: Tool) => void;

// NOTE(sedivy): These events are debounced with the render loop. This means we
// will emit these events once per frame.
interface SceneManagerDebouncedEvents {
  selectedNodePropertyChangeDebounced: () => void;
  selectionChangeDebounced: () => void;
}

interface SceneManagerEvents extends SceneManagerDebouncedEvents {
  finishTextEdit: () => void;
  startTextEdit: (node: SceneNode) => void;

  selectionChange: (nodes: Set<SceneNode>) => void;
  toolChange: (tool: Tool) => void;

  afterUpdate: () => void;
  "document-modified": () => void;

  showSelectUI: (data: {
    x: number;
    y: number;
    options: { value: string; label: string }[];
    onSelect: (value: string) => void;
    currentValue: string | null;
  }) => void;

  didChangeCursor: (cursor: string) => void;
}

type Model = {
  label: string;
  id: string;
  thinking?: boolean;
};

export class SceneManager {
  public dpi: number;
  public activeTool: Tool = "move";
  // TODO(sedivy): Why is this here?
  public didDrag: boolean = false;
  public stateManager: InteractionStateManager;
  public eventEmitter = new EventEmitter<SceneManagerEvents>();
  public pixiManager: PixiManagerAdapter;
  public scenegraph: SceneGraph;
  public guidesGraph: GuidesGraph;
  public selectionManager: SelectionManager;
  public nodeManager: NodeManager;
  public textEditorManager: TextEditorManager;
  public guidesManager: GuidesManager;
  public connectionManager: ConnectionManager;
  public assetManager: AssetManager;
  public fileManager: FileManager;
  public snapManager: SnapManager;
  public undoManager: Undo;
  public variableManager: VariableManager;
  public camera: Camera;
  public colorScheme: string;
  public skiaRenderer!: SkiaRenderer;
  public input: Input | undefined;
  public config: PencilConfig;
  public ipc: IPCHost;

  public currentTime: number = performance.now();
  public deltaTime: number = 0;

  private framesRequested: number = 0;
  private queuedFrameEvents: Set<keyof SceneManagerDebouncedEvents> = new Set();
  private containerBounds: Bounds;

  private visualOffsetAnimations: SceneNode[] = [];

  constructor(
    containerBounds: Bounds,
    colorScheme: string,
    pixiManager: PixiManagerAdapter,
    ipc: IPCHost,
    config: PencilConfig,
  ) {
    this.dpi = platform.getDPI();

    this.scenegraph = new SceneGraph(this);
    this.pixiManager = pixiManager;
    this.containerBounds = containerBounds;
    this.colorScheme = colorScheme;
    this.ipc = ipc;

    this.camera = new Camera();

    this.guidesGraph = new GuidesGraph(this);
    this.selectionManager = new SelectionManager(this);
    this.nodeManager = new NodeManager(this);
    this.textEditorManager = new TextEditorManager(this);
    this.guidesManager = new GuidesManager(this);
    this.connectionManager = new ConnectionManager(this);
    this.fileManager = new FileManager(this);
    this.snapManager = new SnapManager(this);
    this.undoManager = new Undo(this);
    this.variableManager = new VariableManager(this);
    this.stateManager = new InteractionStateManager(this);
    this.assetManager = new AssetManager(this);

    this.config = config;

    this.config.on("change", () => {
      this.requestFrame();
    });

    this.camera.on("change", () => {
      this.guidesGraph.clear();
      this.guidesGraph.clearConnections();

      this.debouncedMoveEnd();
      this.requestFrame();
    });

    this.eventEmitter.on("selectionChange", () => {
      this.queuedFrameEvents.add("selectionChangeDebounced");
      this.requestFrame();
    });

    this.scenegraph.on("nodePropertyChange", (node: SceneNode) => {
      if (this.selectionManager.selectedNodes.has(node)) {
        this.queuedFrameEvents.add("selectedNodePropertyChangeDebounced");
        this.requestFrame();
      }
    });

    this.setCameraPadding();

    this.stateManager.state.onEnter();
  }

  setInput(input: Input): void {
    this.input = input;
  }

  getContainerBounds(): Bounds {
    return this.containerBounds;
  }

  onDidResizeContainer(bounds: Bounds): void {
    const previousCanvasPosition = {
      x: this.containerBounds.x,
      y: this.containerBounds.y,
    };

    this.containerBounds = bounds;

    // NOTE(sedivy): Move the camera in the opposite direction of the
    // container movement to keep the content stable.
    const deltaX = previousCanvasPosition.x - bounds.x;
    const deltaY = previousCanvasPosition.y - bounds.y;
    if (deltaX !== 0 || deltaY !== 0) {
      this.camera.translate(
        -deltaX / this.camera.zoom,
        -deltaY / this.camera.zoom,
      );
    }

    this.resize(bounds.width, bounds.height);
  }

  setCameraPadding() {
    this.camera.pixelPadding[0] = 0;
    this.camera.pixelPadding[1] = 0;
    this.camera.pixelPadding[2] = 0;
    this.camera.pixelPadding[3] = 50; // tools on the left
  }

  resize(width: number, height: number) {
    this.dpi = platform.getDPI();

    this.camera.setSize(width, height);

    // NOTE(sedivy): Manually re-render pixi so it doesn't flicker during resize.
    this.pixiManager.resize(width, height, this.dpi);
    this.guidesGraph.frameNamesManager?.frameTick();
    this.selectionManager.updateMultiSelectGuides();
    this.pixiManager.render();

    if (this.skiaRenderer) {
      this.skiaRenderer.resize();
    }
  }

  private flushDebouncedEvents() {
    for (const event of this.queuedFrameEvents) {
      this.eventEmitter.emit(event);
    }

    this.queuedFrameEvents.clear();
  }

  tick = () => {
    const now = performance.now();
    this.deltaTime = clamp(0, (now - this.currentTime) / 1000, 0.1);
    this.currentTime = now;

    this.beforeUpdate();
    this.pixiManager.update(now);
    this.afterUpdate();

    this.flushDebouncedEvents();

    if (this.framesRequested > 0) {
      this.framesRequested -= 1;
    }

    // NOTE(sedivy): If there are more frames requested after this frame then
    // continue the render loop.
    if (this.framesRequested > 0) {
      requestAnimationFrame(this.tick);
    }
  };

  requestFrame() {
    // NOTE(sedivy): If there are no requested frames start a new render loop.
    if (this.framesRequested === 0) {
      this.currentTime = performance.now();
      requestAnimationFrame(this.tick);
    }

    // NOTE(sedivy): Request atleast 3 frames so the render loop can have a
    // better chance to be continuous.
    this.framesRequested = 3;
  }

  debouncedMoveEnd = debounce(() => {
    if (
      this.skiaRenderer.contentRenderedAtZoom == null ||
      this.skiaRenderer.contentRenderedAtZoom !== this.camera.zoom
    ) {
      this.skiaRenderer.invalidateContent();
    }

    this.selectionManager.updateMultiSelectGuides(false);
    this.connectionManager.redrawAllConnections();
    this.guidesManager.redrawVisibleGuides(); // Update frame name positions
  }, 200);

  getBackgroundColor(): number[] {
    if (this.colorScheme === "dark") {
      return Background.dark;
    }

    return Background.light;
  }

  destroy() {
    this.skiaRenderer.destroy();
    this.assetManager.destroy();
    this.input?.destroy();
  }

  animateVisualOffset(node: SceneNode, x: number, y: number) {
    node.setVisualOffset(x, y);

    if (!this.visualOffsetAnimations.includes(node)) {
      this.visualOffsetAnimations.push(node);
    }
  }

  removeAnimation(node: SceneNode) {
    const index = this.visualOffsetAnimations.indexOf(node);
    if (index !== -1) {
      this.removeAnimationForIndex(index);
    }
  }

  animateLayoutChange(
    modifiedTargets: Set<SceneNode>,
    ignore: Set<SceneNode> | undefined,
  ): void {
    if (modifiedTargets.size > 0) {
      // NOTE(sedivy): Step 1: Record all positions before the layout update.
      const nodePositionsBeforeLayout = new Map<SceneNode, [number, number]>();

      for (const target of modifiedTargets) {
        if (!target.hasLayout()) continue;

        for (const child of target.children) {
          if (ignore?.has(child)) {
            continue;
          }

          nodePositionsBeforeLayout.set(child, [
            child.properties.resolved.x,
            child.properties.resolved.y,
          ]);
        }
      }

      // NOTE(sedivy): Step 2: Update layout.
      // TODO(sedivy): Once we have the ability to perform partial layout
      // updates, we should only update the modified targets.
      this.scenegraph.updateLayout();

      // NOTE(sedivy): Step 3: Adjust visual offsets to match previous positions
      // and start the animations.
      for (const target of modifiedTargets) {
        if (!target.hasLayout()) continue;

        for (const child of target.children) {
          if (ignore?.has(child)) {
            continue;
          }

          const originalPosition = nodePositionsBeforeLayout.get(child);
          if (!originalPosition) {
            continue;
          }

          const deltaX = originalPosition[0] - child.properties.resolved.x;
          const deltaY = originalPosition[1] - child.properties.resolved.y;

          this.animateVisualOffset(
            child,
            child.visualOffset[0] + deltaX,
            child.visualOffset[1] + deltaY,
          );
        }
      }
    }

    this.skiaRenderer.invalidateContent();
  }

  removeAnimationForIndex(index: number) {
    if (index >= this.visualOffsetAnimations.length) {
      return;
    }

    // NOTE(sedivy): Unordered delete from a list.
    this.visualOffsetAnimations[index] =
      this.visualOffsetAnimations[this.visualOffsetAnimations.length - 1];
    this.visualOffsetAnimations.length -= 1;
  }

  beforeUpdate() {
    this.guidesGraph.frameNamesManager?.frameTick();

    if (this.visualOffsetAnimations.length > 0) {
      const dt = this.deltaTime;

      for (let index = 0; index < this.visualOffsetAnimations.length; ) {
        const node = this.visualOffsetAnimations[index];

        if (!node.destroyed) {
          node.setVisualOffset(
            expDecay(node.visualOffset[0], 0, 20, dt),
            expDecay(node.visualOffset[1], 0, 20, dt),
          );

          // NOTE(sedivy): Continue animating the node if it's not at the target.
          if (
            !almostEquals(node.visualOffset[0], 0, 0.5) ||
            !almostEquals(node.visualOffset[1], 0, 0.5)
          ) {
            index++;
            continue;
          }
        }

        // NOTE(sedivy): Animation is finished or the node is destroyed. Remove the animation.

        node.setVisualOffset(0, 0);

        this.removeAnimationForIndex(index);
      }

      this.skiaRenderer.invalidateContent();
      this.selectionManager.updateMultiSelectGuides();
    }
  }

  afterUpdate() {
    this.eventEmitter.emit("afterUpdate");

    if (this.skiaRenderer) {
      this.skiaRenderer.render();
    }
  }

  getConnectionsContainer(): Container {
    return this.guidesGraph.getConnectionsContainer();
  }

  // Method to subscribe to property changes
  subscribePropertyChange(callback: PropertyChangeCallback) {
    this.scenegraph.on("nodePropertyChange", callback);
  }

  // Method to unsubscribe from property changes
  unsubscribePropertyChange(callback: PropertyChangeCallback) {
    this.scenegraph.off("nodePropertyChange", callback);
  }

  setInteractionsEnabled(enabled: boolean) {
    this.input?.setEnabled(enabled);
  }

  setActiveTool(tool: Tool) {
    if (this.activeTool === tool) return; // Avoid unnecessary updates
    if (!this.input?.isEnabled()) return; // No-op if interactions are disabled

    posthog.capture("set-active-tool", { tool: tool });

    const previousTool = this.activeTool;

    this.activeTool = tool;
    this.guidesManager.finishDrawingGuide(); // Delegate to coordinator
    logger.debug("Active tool:", this.activeTool);
    // Emit the tool change event
    this.eventEmitter.emit("toolChange", this.activeTool);

    // If a state wants to react to tool changes, notify it
    if (this.stateManager.onToolChange) {
      this.stateManager.onToolChange(previousTool, tool);
    } else {
      // Default behavior: If not idle and tool changes, usually go back to idle
      if (!(this.stateManager.state instanceof IdleState)) {
        // Special case: Don't exit text edit just because tool changed
        if (!(this.stateManager.state instanceof EditingTextState)) {
          this.stateManager.transitionTo(new IdleState(this));
        }
      }
    }

    this.selectionManager.updateMultiSelectGuides(); // Update guides based on potential state change
  }

  getActiveTool() {
    return this.activeTool;
  }

  updateBoundingBox(node: SceneNode) {
    this.guidesManager.updateBoundingBox(node);
  }

  public onConnectionsChanged(connections: Connection[]): void {
    this.guidesGraph.drawConnections(connections);
  }

  public setCursor(cursor: string): void {
    this.eventEmitter.emit("didChangeCursor", cursor);
  }

  render(renderer: SkiaRenderer, canvas: Canvas) {
    // NOTE(sedivy): Render outline for selected nodes as a common behavior for every state.
    // TODO(sedivy): We don't want to render outlines when in the MovingState
    // state. Should we force every state that wants hover to include a function
    // call or should we list out states that *don't* want hover? For now, I just
    // put in a simple if statement.
    if (!(this.stateManager.state instanceof MovingState)) {
      const zoom = this.camera.zoom;
      const thickness = 1 / zoom;

      for (const node of this.selectionManager.selectedNodes) {
        renderer.renderNodeOutline(node, thickness);
      }
    }

    this.stateManager.state.render(renderer, canvas);

    this.snapManager.render(canvas);
  }

  async saveDocument() {
    posthog.capture("save-file");

    for (const node of this.scenegraph.nodes) {
      if (node.properties.placeholder) {
        node.properties.placeholder = false;
      }
    }

    try {
      const jsonData = this.fileManager.export();

      logger.debug("Sending save message with payload:", jsonData);
      await this.ipc.request<{ content: string }>("save", {
        content: jsonData,
      });
    } catch (error) {
      posthog.capture("save-file-failed", { error });
      logger.error("Error during save:", error);
      reportError(error);
      toast.error(`Failed to save file`, {
        id: "file-error",
        description: error instanceof Error ? error.message : undefined,
        descriptionClassName: "sonner-description text-xxs",
      });
    }
  }

  submitPrompt(prompt: string, model: string | undefined): void {
    posthog.capture("submit-prompt");

    this.ipc.notify<{ prompt: string; model: string | undefined }>(
      "submit-prompt",
      {
        prompt,
        model,
      },
    );
  }

  getAvailableModels(): { models: Model[]; defaultModel?: Model } {
    if (platform.appName === "Cursor") {
      const defaultModel = {
        label: "Composer",
        id: "cursor-composer",
      };

      return {
        models: [
          {
            label: "Sonnet 4.5",
            id: "claude-4.5-sonnet",
          },
          {
            label: "Haiku 4.5",
            id: "claude-4.5-haiku",
          },
          defaultModel,
        ],
        defaultModel,
      };
    }

    if (platform.appName === "Electron") {
      const defaultModel = {
        label: "Sonnet 4.5",
        id: "claude-4.5-sonnet",
      };
      return {
        models: [
          {
            label: "Sonnet 4.5",
            id: "claude-4.5-sonnet",
          },
          {
            label: "Haiku 4.5",
            id: "claude-4.5-haiku",
          },
          {
            label: "Opus 4.5",
            id: "claude-4.5-opus",
          },
        ],
        defaultModel,
      };
    }

    return { models: [] };
  }
}
