import type { SceneManager } from "./scene-manager";

export class HandState {
  public canvasDragging: boolean = false;
  public canvasDragStartX: number = 0;
  public canvasDragStartY: number = 0;

  handlePointerDown(event: MouseEvent, manager: SceneManager) {
    if (!this.canvasDragging && manager.input) {
      event.stopPropagation();
      event.preventDefault();

      this.canvasDragging = true;
      this.canvasDragStartX = manager.input.mouse.canvas.x;
      this.canvasDragStartY = manager.input.mouse.canvas.y;

      manager.setCursor("grabbing");
    }
  }

  handlePointerMove(event: MouseEvent, manager: SceneManager) {
    manager.setCursor(this.canvasDragging ? "grabbing" : "grab");

    if (this.canvasDragging && manager.input) {
      const deltaX = manager.input.mouse.canvas.x - this.canvasDragStartX;
      const deltaY = manager.input.mouse.canvas.y - this.canvasDragStartY;

      manager.camera.translate(
        -deltaX / manager.camera.zoom,
        -deltaY / manager.camera.zoom,
      );

      this.canvasDragStartX = manager.input.mouse.canvas.x;
      this.canvasDragStartY = manager.input.mouse.canvas.y;
    }
  }

  handlePointerUp(event: MouseEvent, manager: SceneManager) {
    if (this.canvasDragging) {
      event.stopPropagation();
      event.preventDefault();

      this.canvasDragging = false;
      manager.setCursor("grab");

      if (
        manager.input &&
        !manager.input.pressedKeys.has("Space") &&
        manager.activeTool !== "hand"
      ) {
        this.exit(manager);
      }
    }
  }

  activate(manager: SceneManager) {
    if (!this.canvasDragging) {
      manager.setCursor("grab");
      manager.pixiManager.disableInteractions();
    }
  }

  exit(manager: SceneManager) {
    this.canvasDragging = false;
    manager.pixiManager.enableInteractions();
    manager.setCursor("default");
  }
}
