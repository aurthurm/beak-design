import {
  CanvasTextMetrics,
  Container,
  Point,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";
import { MovingState } from "../interaction-states/moving-state";
import type { SceneManager } from "../managers/scene-manager";
import * as platform from "../platform";
import { COLORS, UI_FONT_FAMILY } from "../utils/constants";
import type { FrameNode } from "./nodes/frame-node";

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(
        new Error("Image constructor not available in headless environment"),
      );
      return;
    }

    const img = new Image();

    img.onload = () => {
      resolve(img);
    };

    img.onerror = () => {
      reject();
    };

    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  });
}

const icons = {
  sparkle: {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>`,
    width: 13,
    height: 13,
    texture: null as Texture | null,
  },
};

class FrameCaption {
  public container: Container;
  private text: Text;
  private icon: Sprite | null = null;

  public node: FrameNode;

  private sceneManager: SceneManager;

  private fullText?: string;
  private fullTextWidth: number = 0;
  private textPartsCache: string[] = [];
  private textPartSizeCache: number[] = [];

  private lastRenderedWidth: number = -1;

  constructor(node: FrameNode, sceneManager: SceneManager) {
    this.sceneManager = sceneManager;

    this.container = new Container();

    this.container.eventMode = "static";

    this.container.on("pointerdown", (event) => {
      event.stopPropagation();

      if (!this.sceneManager.selectionManager.selectedNodes.has(node)) {
        this.sceneManager.selectionManager.selectNode(node, event.shiftKey);
      }

      if (this.sceneManager.input) {
        this.sceneManager.stateManager.transitionTo(
          new MovingState(this.sceneManager),
        );
      }
    });

    this.text = new Text({
      style: new TextStyle({
        fontFamily: UI_FONT_FAMILY,
        fontSize: 11,
      }),
    });

    this.container.addChild(this.text);

    this.node = node;

    this.contentModified();
  }

  private setIcon(texture: Texture, width: number, height: number) {
    if (this.icon) {
      return;
    }

    const sprite = new Sprite(texture);
    sprite.width = width;
    sprite.height = height;
    this.icon = sprite;

    this.container.addChild(sprite);
  }

  contentModified() {
    this.fullTextWidth = 0;
    this.textPartsCache.length = 0;
    this.textPartSizeCache.length = 0;
    this.lastRenderedWidth = -1;

    let text = "";

    if (this.node.properties.resolved.placeholder) {
      text += "Generating";
    }

    if (this.node.properties.resolved.name) {
      if (text.length) text += ": ";
      text += this.node.properties.resolved.name;
    }

    this.fullText = text;

    // NOTE(sedivy): Because we will need to check the text truncation every single
    // render frame, we need to pre-cache all the breaking points.
    //
    // During zooming the screen space width of the frame is changing, so the text
    // truncation will need to be updated. To not call the expensive measureText
    // function all the time, we pre-measure all the breaking points and then do a
    // simple iteration to find the maximum amount of text that can fit.
    if (text) {
      this.fullTextWidth = this.measureText(text);

      for (let i = 0; i < text.length; i++) {
        const part = `${text.slice(0, i)}...`;

        this.textPartsCache.push(part);
        this.textPartSizeCache.push(this.measureText(part));
      }
    }
  }

  private measureText(text: string): number {
    return CanvasTextMetrics.measureText(text, this.text.style).width;
  }

  private getTruncatedText(targetWidth: number): string {
    const text = this.fullText;
    if (!text) {
      return "";
    }

    if (this.textPartsCache.length === 0) {
      return "";
    }

    // TODO(sedivy): Don't do any truncation when the text fits.
    if (this.fullTextWidth <= targetWidth) {
      return text;
    }

    let lastValidIndex = 0;

    // NOTE(sedivy): Find the breaking point where the text no longer fits.
    for (let i = 0; i < this.textPartSizeCache.length; i++) {
      // TODO(sedivy): This can be a binary search if we want to optimize it more.
      if (this.textPartSizeCache[i] > targetWidth) {
        break;
      }

      lastValidIndex = i;
    }

    return this.textPartsCache[lastValidIndex];
  }

  update() {
    const zoom = this.sceneManager.camera.zoom;

    const bounds = this.node.localBounds();

    if (this.node.properties.resolved.placeholder) {
      if (icons.sparkle.texture) {
        this.setIcon(
          icons.sparkle.texture,
          icons.sparkle.width,
          icons.sparkle.height,
        );
      }
    } else {
      this.icon?.destroy();
      this.icon = null;
    }

    const bottomPadding = 7;
    const iconPadding = 5;

    const screenSpaceWidth =
      Math.floor(bounds.width * zoom) -
      (this.icon ? this.icon?.width + iconPadding : 0);

    // NOTE(sedivy): Only update truncation if the size is different from the last frame.
    if (screenSpaceWidth !== this.lastRenderedWidth) {
      this.lastRenderedWidth = screenSpaceWidth;
      this.text.text = this.getTruncatedText(screenSpaceWidth);
    }

    const verticalOffset = -(bottomPadding + this.text.height);

    if (this.icon) {
      this.icon.position.set(
        0,
        verticalOffset + Math.sin(this.sceneManager.currentTime / 200) * 0.6,
      );
      this.sceneManager.requestFrame();
    }

    let cursorX = 0;

    if (this.icon) {
      cursorX += this.icon.width + iconPadding;
    }

    this.text.position.set(cursorX, verticalOffset);

    const worldMatrix = this.node.getWorldMatrix();

    // TODO(sedivy): This does not handle objects with flipX/flipY mirror.
    const worldRotation = Math.atan2(worldMatrix.b, worldMatrix.a);

    // TODO(sedivy): This is not entirely correct. When the frame is
    // upside down we want to use a different corner with the correct
    // rotation so the text is always readable.
    const point = worldMatrix.apply(new Point(bounds.minX, bounds.minY));

    this.container.position = this.sceneManager.camera.toScreen(
      point.x,
      point.y,
    );

    this.container.rotation = worldRotation;

    const isSelected = this.sceneManager.selectionManager.selectedNodes.has(
      this.node,
    );

    let color = COLORS.LIGHT_BLUE;

    if (isSelected) {
      if (this.node.reusable) {
        color = COLORS.MAGENTA;
      } else if (Boolean(this.node.prototype)) {
        color = COLORS.PURPLE;
      } else {
        color = COLORS.LIGHT_BLUE;
      }
    } else {
      if (this.node.properties.resolved.placeholder) {
        color = [96 / 255, 125 / 255, 255 / 255, 1];
      } else {
        color = COLORS.GRAY;
      }
    }

    if (this.icon) {
      this.icon.tint = color;
    }
    this.text.style.fill = color;
  }

  destroy() {
    this.container.removeFromParent();
    this.container.destroy({ children: true });
  }
}

export class FrameNamesManager {
  public container: Container;
  private activeCaptions: Map<FrameNode, FrameCaption> = new Map();
  private sceneManager: SceneManager;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;

    this.container = new Container();
    this.container.zIndex = 1000;

    loadSvgImage(icons.sparkle.source).then((img: HTMLImageElement) => {
      const icon = icons.sparkle;

      // TODO(sedivy): Switching between different DPI monitors will not redraw the icon.
      const dpi = platform.getDPI();
      const width = icon.width;
      const height = icon.height;

      // In headless mode we dont have access to document, and also this feature
      // is not used there.
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = width * dpi;
        canvas.height = height * dpi;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        icon.texture = Texture.from(canvas);
      }
    });
  }

  private removeCaption(caption: FrameCaption) {
    caption.destroy();
    this.activeCaptions.delete(caption.node);
  }

  frameParendChange(node: FrameNode): void {
    if (node.parent?.root) {
      this.frameAdded(node);
    } else {
      this.frameRemoved(node);
    }
  }

  frameAdded(node: FrameNode): void {
    if (!node.parent?.root) return;

    if (this.activeCaptions.has(node)) {
      // NOTE(sedivy): Should not happen, but let's be careful to not create
      // multiple captions for the same frame.
      return;
    }

    const caption = new FrameCaption(node, this.sceneManager);

    this.container.addChild(caption.container);
    this.activeCaptions.set(node, caption);
  }

  frameNameChange(node: FrameNode): void {
    const caption = this.activeCaptions.get(node);
    if (caption) {
      caption.contentModified();
    }
  }

  frameRemoved(node: FrameNode): void {
    const caption = this.activeCaptions.get(node);
    if (caption) {
      this.removeCaption(caption);
    }
  }

  frameTick(): void {
    // TODO(sedivy): Do some kind of culling. There is no point of updating
    // everything all the time.
    for (const [_, caption] of this.activeCaptions) {
      caption.update();
    }
  }
}
