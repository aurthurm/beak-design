import type { PixiManagerAdapter } from "@ha/pencil-editor";
import { PIXI } from "@ha/pencil-editor";
import gsap from "gsap";
import { PixiPlugin } from "gsap/PixiPlugin";

declare global {
  interface Window {
    __PIXI_APP__: PIXI.Application;
  }
}

export class PixiManager implements PixiManagerAdapter {
  public app: PIXI.Application;

  static async create(container: HTMLElement): Promise<PixiManager> {
    gsap.registerPlugin(PixiPlugin);
    PixiPlugin.registerPIXI(PIXI);

    const app = new PIXI.Application();
    window.__PIXI_APP__ = app;

    await app.init({
      antialias: true,
      autoDensity: true,
      resolution: 2,
      backgroundAlpha: 0,
      resizeTo: container,
      autoStart: false,
    });

    app.ticker.stop();
    PIXI.Ticker.system.stop();

    container.appendChild(app.canvas);
    app.canvas.style.position = "absolute";
    app.canvas.style.top = "0px";
    app.canvas.style.left = "0px";

    app.stage.eventMode = "static";

    return new PixiManager(app);
  }

  private constructor(app: PIXI.Application) {
    this.app = app;
  }

  disableInteractions(): void {
    this.app.stage.eventMode = "none";
  }

  enableInteractions(): void {
    this.app.stage.eventMode = "static";
  }

  resize(width: number, height: number, dpi: number): void {
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
    this.app.renderer.resize(width, height, dpi);
  }

  render(): void {
    this.app.render();
  }

  update(timestamp: number): void {
    this.app.ticker.update(timestamp);
  }

  addContainer(container: PIXI.Container): void {
    this.app.stage.addChild(container);
  }
}
