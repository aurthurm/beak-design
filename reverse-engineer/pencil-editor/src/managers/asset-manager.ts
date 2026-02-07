import { IPCError } from "@ha/shared";
import type { Image } from "@highagency/pencil-skia";
import path from "path-browserify";
import { toast } from "sonner";
import { reportError } from "../error-reporter";
import { Skia } from "../skia";
import type { SceneManager } from "./scene-manager";

export type AssetState =
  | { status: "init" }
  | { status: "loading"; promise: Promise<ArrayBuffer> }
  | { status: "loaded"; decodedImage: Image }
  | { status: "error" };

export class Asset {
  public url: string;
  public state: AssetState = { status: "init" };

  constructor(url: string) {
    this.url = url;
  }
}

export class AssetManager {
  private manager: SceneManager;

  // TODO(sedivy): Add an LRU cache so we can unload assets that are not needed.
  private assets: Map<string, Asset> = new Map();

  constructor(manager: SceneManager) {
    this.manager = manager;
  }

  // NOTE(sedivy): This API uses an immediate style api instead of
  // aqcuire/release style. This means we don't have to do any reference
  // counting and manual release of assets when using the API. The cache
  // inside the AssetManager will handle asset lifetime based on its own
  // constraints like memory usage and recently used assets.
  //
  // Don't store a reference to Asset in your class. Anytime you need an
  // asset call getAsset(url).
  getAsset(url: string): Asset {
    const existing = this.assets.get(url);
    if (existing) {
      return existing;
    }

    const asset = new Asset(url);
    this.assets.set(url, asset);

    this.beginLoadAsset(asset);

    return asset;
  }

  private async beginLoadAsset(asset: Asset) {
    if (asset.state.status !== "init") {
      return;
    }

    const url = asset.url;
    if (!url) {
      this.setAssetState(asset, { status: "error" });
      return;
    }

    try {
      const promise = this.fetch(url);
      this.setAssetState(asset, { status: "loading", promise });

      const bytes = await promise;

      if (!bytes || bytes.byteLength === 0) {
        this.setAssetState(asset, { status: "error" });
        toast.error(`Image asset "${path.basename(url)}" is empty`);
        return;
      }

      // TODO(sedivy): Do the image decoding in a web worker.
      const decodedImage = Skia.MakeImageFromEncoded(bytes);
      if (!decodedImage) {
        this.setAssetState(asset, { status: "error" });
        toast.error(`Image asset "${path.basename(url)}" is not a valid image`);
        return;
      }

      this.setAssetState(asset, {
        status: "loaded",
        decodedImage,
      });
    } catch (e) {
      this.setAssetState(asset, { status: "error" });

      if (e instanceof IPCError) {
        const filename = path.basename(url);

        switch (e.code) {
          case "TIMEOUT": {
            toast.error(`Timed out loading "${filename}"`);
            return;
          }
          default: {
            if (
              e.message.includes("FileNotFound") ||
              e.message.includes("ENOENT")
            ) {
              toast.error(`Image file not found: "${url}"`);
              return;
            }
            if (e.message.includes("NoPermissions")) {
              toast.error(`Permission denied: "${filename}"`);
              return;
            }
          }
        }
      }

      toast.error(`Failed to load "${url}"`);
      reportError(e);
    }
  }

  private async fetch(url: string): Promise<ArrayBuffer> {
    // NOTE(sedivy): URL fetching.
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const request = await fetch(url);
      if (!request.ok) {
        throw new Error(`HTTP error ${request.status} loading "${url}"`);
      }
      return await request.arrayBuffer();
    }

    // NOTE(sedivy): Local file fetching.
    const documentPath = this.manager.scenegraph.documentPath;
    if (!documentPath) {
      throw new Error("Cannot load asset without document path");
    }

    const absolutePath = path.isAbsolute(url)
      ? url
      : path.join(path.dirname(documentPath), url);

    return this.manager.ipc.request<string, ArrayBuffer>(
      "read-file",
      absolutePath,
    );
  }

  destroy() {
    for (const [_, asset] of this.assets) {
      if (asset.state.status === "loaded") {
        asset.state.decodedImage.delete();
      }
    }

    this.assets.clear();
  }

  private setAssetState(asset: Asset, state: AssetState) {
    asset.state = state;
    this.manager.skiaRenderer.invalidateContent();
  }

  async waitForAllAssetsLoaded() {
    for (const [_, asset] of this.assets) {
      if (asset.state.status === "loading") {
        await asset.state.promise;
      }
    }
  }
}
