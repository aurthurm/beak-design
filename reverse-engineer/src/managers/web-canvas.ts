import type { Surface } from "@highagency/pencil-skia";
import EventEmitter from "eventemitter3";
import {
  Skia,
  type PencilCanvas,
  type PencilCanvasEvents,
} from "@ha/pencil-editor";

export class PencilWebCanvas
  extends EventEmitter<PencilCanvasEvents>
  implements PencilCanvas
{
  private _initialized: boolean = false;
  private contextLost: boolean = false;

  constructor(private readonly htmlCanvas: HTMLCanvasElement) {
    super();

    htmlCanvas.addEventListener("webglcontextlost", this.handleContextLost);
    htmlCanvas.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
  }

  get initialized(): boolean {
    return this._initialized;
  }

  get width(): number {
    return this.htmlCanvas.width;
  }

  get height(): number {
    return this.htmlCanvas.height;
  }

  get isContextLost(): boolean {
    return this.contextLost;
  }

  setActive(active: boolean): void {
    if (active) {
      this.htmlCanvas.style.display = "block";
    } else {
      this.htmlCanvas.style.display = "none";
    }
  }

  createSurface(): Surface | null {
    return Skia.MakeWebGLCanvasSurface(this.htmlCanvas, Skia.ColorSpace.SRGB, {
      preserveDrawingBuffer: 1,
      antialias: 1,
    });
  }

  destroy(): void {
    this.htmlCanvas.removeEventListener(
      "webglcontextlost",
      this.handleContextLost,
    );
    this.htmlCanvas.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
  }

  resize(
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number,
  ): void {
    this.htmlCanvas.width = width;
    this.htmlCanvas.height = height;
    this.htmlCanvas.style.width = `${screenWidth}px`;
    this.htmlCanvas.style.height = `${screenHeight}px`;
    this._initialized = true;
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = (e: Event) => {
    e.preventDefault();
    this.contextLost = false;
    this.emit("context-restored");
  };
}
