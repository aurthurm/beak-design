import type { PencilConfigData, PencilConfigEvents } from "@ha/pencil-editor";
import { logger } from "@ha/shared";
import { EventEmitter } from "eventemitter3";

const defaultConfigData: Readonly<PencilConfigData> = {
  snapToObjects: true,
  roundToPixels: true,
  showPixelGrid: true,
  scrollWheelZoom: false,
  invertZoomDirection: false,

  leftPanelWidth: 200,
  leftPanelOpen: true,
  hideSidebarWhenLayersAreOpen: false,
  generatingEffectEnabled: true,
};

export class Config extends EventEmitter<PencilConfigEvents> {
  private _data: PencilConfigData = structuredClone(defaultConfigData);

  constructor() {
    super();

    const savedData = localStorage.getItem("pencil-config");
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);

        for (const key in defaultConfigData) {
          if (key in parsedData) {
            const value = parsedData[key];

            // TODO(sedivy): Generalize validation for all keys.
            if (key === "leftPanelWidth" && typeof value !== "number") {
              continue;
            }

            (this._data as any)[key] = value;
          }
        }
      } catch (e) {
        logger.error("Failed to parse config from localStorage:", e);
      }
    }
  }

  get data(): Readonly<PencilConfigData> {
    return this._data;
  }

  set<K extends keyof PencilConfigData>(
    key: K,
    value: PencilConfigData[K],
  ): void {
    const oldValue = this._data[key];
    this._data[key] = value;

    localStorage.setItem("pencil-config", JSON.stringify(this._data));

    this.emit("change", key, oldValue, value);
  }
}
