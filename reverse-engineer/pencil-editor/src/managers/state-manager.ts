import { CornerRadiusAdjustingState } from "../interaction-states/corner-radius-adjusting-state";
import { DrawingState } from "../interaction-states/drawing-state";
import { EditingTextState } from "../interaction-states/editing-text-state";
import { IdleState } from "../interaction-states/idle-state";
import type { InteractionState } from "../interaction-states/interaction-state";
import { MarqueeSelectingState } from "../interaction-states/marquee-selecting-state";
import { MeshGradientEditorState } from "../interaction-states/mesh-gradient-editor-state";
import { MovingState } from "../interaction-states/moving-state";
import { ResizingState } from "../interaction-states/resizing-state";
import { RotatingState } from "../interaction-states/rotating-state";
import { TextToolState } from "../interaction-states/text-tool-state";
import { HandState } from "./hand-state";
import type { SceneManager, Tool } from "./scene-manager";

export class InteractionStateManager {
  private manager: SceneManager;

  public state: InteractionState;

  // NOTE(sedivy): The hand state should work on top of all states and when when
  // using the hand state we shouldn't loose any current state properties when
  // entering or existing.
  private handState: HandState = new HandState();

  constructor(sceneManager: SceneManager) {
    this.manager = sceneManager;
    this.state = new IdleState(sceneManager);
  }

  handlePointerDown(event: MouseEvent) {
    if (!this.manager.input) {
      return;
    }

    this.manager.requestFrame();

    if (
      this.manager.activeTool === "hand" ||
      this.handState.canvasDragging ||
      (this.manager.input.pressedKeys.has("Space") && event.button === 0) ||
      event.button === 1
    ) {
      this.handState.handlePointerDown(event, this.manager);
      return;
    }

    this.state.onPointerDown(event);
  }

  handlePointerMove(event: MouseEvent) {
    if (!this.manager.input) {
      return;
    }

    this.manager.requestFrame();

    if (
      this.manager.activeTool === "hand" ||
      this.handState.canvasDragging ||
      (this.manager.input.pressedKeys.has("Space") &&
        !this.manager.input.mouse.pointerDown)
    ) {
      this.handState.handlePointerMove(event, this.manager);
      return;
    }

    this.manager.setCursor("default");

    this.state.onPointerMove(event);
  }

  handlePointerUp(event: MouseEvent) {
    this.manager.requestFrame();

    if (this.manager.activeTool === "hand" || this.handState.canvasDragging) {
      this.handState.handlePointerUp(event, this.manager);
      return;
    }

    this.state.onPointerUp(event);
  }

  handleWindowBlur() {
    this.handState.exit(this.manager);

    this.state.onWindowBlur?.();
    this.manager.requestFrame();
  }

  handleKeydown(event: KeyboardEvent) {
    if (!this.manager.input) {
      return;
    }

    if (event.code === "Space" && !this.manager.input.mouse.pointerDown) {
      this.handState.activate(this.manager);
    }
  }

  handleKeyup(event: KeyboardEvent) {
    if (
      event.code === "Space" &&
      !this.handState.canvasDragging &&
      this.manager.activeTool !== "hand"
    ) {
      this.handState.exit(this.manager);
    }
  }

  public transitionTo(newState: InteractionState) {
    if (this.state === newState) {
      return;
    }

    this.state.onExit();
    this.state = newState;
    this.state.onEnter();

    this.manager.requestFrame();
  }

  onToolChange(prev: Tool, current: Tool) {
    if (current === "hand") {
      this.handState.activate(this.manager);
    } else if (prev === "hand" && !this.handState.canvasDragging) {
      this.handState.exit(this.manager);
    }

    this.state.onToolChange?.(prev, current);
  }
}

export {
  IdleState,
  MovingState,
  ResizingState,
  DrawingState,
  MarqueeSelectingState,
  CornerRadiusAdjustingState,
  TextToolState,
  EditingTextState,
  RotatingState,
  MeshGradientEditorState,
};
