import type { TypefaceFontProvider } from "@highagency/pencil-skia";
import * as Base64 from "base64-js";
import { inflateRaw } from "pako";
import FALLBACK_FONT_FAMILIES from "./data/font-fallback-index.json";
import FONT_INDEX from "./data/font-index.json";
import { logger } from "@ha/shared";
import { Skia } from "../skia";
import { isHeadlessMode } from "../platform";

const FONT_INDEX_MAP = new Map<string, FontRecord>();
for (const font of FONT_INDEX) {
  FONT_INDEX_MAP.set(font.name, font);
}

const FONT_NAMES = FONT_INDEX.map((f) => f.name);

type FontRecordStyle = {
  url: string;
  weight?: number;
  italic?: boolean;
  axes?: FontRecordAxis[];
};

type FontRecordAxis = {
  tag: string;
  start?: number;
  end?: number;
};

type FontRecord = {
  name: string;
  styles: FontRecordStyle[];
};

class MatchedFont {
  font: FontRecord;
  styleIndex: number;

  constructor(font: FontRecord, styleIndex: number) {
    this.font = font;
    this.styleIndex = styleIndex;
  }

  key(): string {
    return `${this.font.name}-${this.styleIndex}`;
  }
}

export class FallbackFontFamilyInfo {
  matchedFont: MatchedFont;

  private readonly metadata: Uint8Array;

  constructor(matchedFont: MatchedFont, base64Metadata: string) {
    this.matchedFont = matchedFont;
    this.metadata = inflateRaw(Base64.toByteArray(base64Metadata));
  }

  hasCodepoint(codepoint: number): boolean {
    // See scripts/generate-font-index.ts for the font metadata format.
    const bitmapBitSizeExponent = 13;
    const bitmapByteSize = 1 << (bitmapBitSizeExponent - 3);
    const bitmapIndex = codepoint >> bitmapBitSizeExponent;
    const bitmaps = this.metadata;
    for (let i = 0; i < bitmaps[0]; i++) {
      // NOTE(zaza): in practice bitmaps[0] < 30, so linear search is likely optimal.
      if (bitmaps[1 + i] === bitmapIndex) {
        const byteIndex = (codepoint & ((1 << bitmapBitSizeExponent) - 1)) >> 3;
        const bitIndex = codepoint & 7;
        const bitmapStartOffset = 1 + bitmaps[0] + i * bitmapByteSize;
        return (bitmaps[bitmapStartOffset + byteIndex] & (1 << bitIndex)) !== 0;
      }
    }
    return false;
  }
}

enum LoadStatus {
  NotLoaded,
  Loaded,
  Loading,
  Failed,
}

export class SkiaFontManager {
  private onFontsChangedCallback: () => void;
  private registerCssFontFace: boolean;

  readonly typefaceFontProvider: TypefaceFontProvider;

  private readonly fallbackFontFamilies: FallbackFontFamilyInfo[];

  private processedFonts = new Map<string, LoadStatus>();
  private activePromises = new Map<string, Promise<void>>();

  private cacheLoadedFallbackFontFamilies: string[] | null = null;

  constructor(
    onFontsChangedCallback: () => void,
    registerCssFontFace: boolean,
  ) {
    this.registerCssFontFace = registerCssFontFace;
    this.onFontsChangedCallback = onFontsChangedCallback;
    this.typefaceFontProvider = Skia.TypefaceFontProvider.Make();

    this.fallbackFontFamilies = FALLBACK_FONT_FAMILIES.map((font) => {
      const match = this.matchFont(font.name, 400, false);
      if (!match) {
        throw new Error(
          `Fallback font ${font.name} is not present in the font index`,
        );
      }

      return new FallbackFontFamilyInfo(match, font.data);
    });
  }

  destroy() {
    this.typefaceFontProvider.delete();
  }

  get loadedFallbackFontFamilies(): string[] {
    if (this.cacheLoadedFallbackFontFamilies) {
      return this.cacheLoadedFallbackFontFamilies;
    }

    const names = [];

    for (const fallback of this.fallbackFontFamilies) {
      if (this.getFontStatus(fallback.matchedFont) === LoadStatus.Loaded) {
        names.push(fallback.matchedFont.key());
      }
    }

    this.cacheLoadedFallbackFontFamilies = names;

    return names;
  }

  async loadFont(matchedFont: MatchedFont): Promise<void> {
    const key = matchedFont.key();

    const existingPromise = this.activePromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const status = this.getFontStatus(matchedFont);
    if (status !== LoadStatus.NotLoaded) {
      return;
    }

    this.processedFonts.set(key, LoadStatus.Loading);

    const load = async () => {
      try {
        const style = matchedFont.font.styles[matchedFont.styleIndex];

        if (this.registerCssFontFace) {
          addCssFontFace(key, style.url);
        }

        logger.debug(`Loading font family '${key}' from ${style.url}`);
        const response = await fetch(style.url);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch font from ${style.url}: ${response.statusText}`,
          );
        }

        const fontData = await response.arrayBuffer();

        this.typefaceFontProvider.registerFont(fontData, key);

        this.processedFonts.set(key, LoadStatus.Loaded);
      } catch (e) {
        logger.error(`Failed to load font family '${key}'`, e);
        this.processedFonts.set(key, LoadStatus.Failed);
      } finally {
        this.activePromises.delete(key);
        if (this.activePromises.size === 0) {
          // NOTE(zaza): this will trigger text relayout/reshaping across the whole document.
          // This is expensive, so as an optimization, we postpone it until all currently loading
          // fonts have finished loading (e.g. many fonts can be loaded on document open).
          this.onFontsChanged();
        }
      }
    };

    const promise = load();

    this.activePromises.set(key, promise);

    return promise;
  }

  async waitForAllFontsLoaded(): Promise<void> {
    await Promise.allSettled(this.activePromises.values());
  }

  private onFontsChanged() {
    this.cacheLoadedFallbackFontFamilies = null;

    this.onFontsChangedCallback();
  }

  getFontList(
    matchedFont: MatchedFont | undefined,
    allowFallbacks: boolean = true,
  ): string[] {
    const fallbacks =
      matchedFont == null || allowFallbacks
        ? this.loadedFallbackFontFamilies
        : [];

    if (!matchedFont) {
      return fallbacks;
    }

    const status = this.getFontStatus(matchedFont);
    if (status === LoadStatus.NotLoaded) {
      this.loadFont(matchedFont);
      return fallbacks;
    }

    return [matchedFont.key(), ...fallbacks];
  }

  private getFontStatus(matchedFont: MatchedFont): LoadStatus {
    return this.processedFonts.get(matchedFont.key()) ?? LoadStatus.NotLoaded;
  }

  loadFallbackFontsForMissingCodepoints(missingCodepoints: number[]): void {
    for (const fallback of this.fallbackFontFamilies) {
      if (this.getFontStatus(fallback.matchedFont) === LoadStatus.NotLoaded) {
        const hasCodepoints = missingCodepoints.some(
          (missingCodepoint) =>
            missingCodepoint > 127 && fallback.hasCodepoint(missingCodepoint),
        );

        if (hasCodepoints) {
          this.loadFont(fallback.matchedFont);
        }
      }
    }
  }

  public getSupportedFontNames(): string[] {
    return FONT_NAMES;
  }

  public getSupportedWeights(fontName: string): {
    normal: number[];
    italic: number[];
  } {
    const result = { normal: [] as number[], italic: [] as number[] };

    const item = FONT_INDEX_MAP.get(fontName);
    if (!item) {
      return result;
    }

    for (const style of item.styles) {
      const bucket = style.italic ? result.italic : result.normal;

      if (style.weight) {
        bucket.push(style.weight);
      }

      if (style.axes) {
        const weightAxis = style.axes.find((a) => a.tag === "wght");
        if (weightAxis) {
          const start = weightAxis.start ?? 100;
          const end = weightAxis.end ?? 900;

          for (let weight = start; weight <= end; weight += 100) {
            if (!bucket.includes(weight)) {
              bucket.push(weight);
            }
          }
        }
      }
    }

    result.normal.sort((a, b) => a - b);
    result.italic.sort((a, b) => a - b);

    return result;
  }

  getFontForFamily(name: string): FontRecord | undefined {
    return FONT_INDEX_MAP.get(name);
  }

  matchFont(
    name: string,
    weight: number,
    italic: boolean,
  ): MatchedFont | undefined {
    const record = FONT_INDEX_MAP.get(name);
    if (!record) {
      return;
    }

    let bestStyleIndex = 0;
    let bestDistance = Number.MAX_VALUE;
    let hasItalicMatch = false;

    for (let i = 0; i < record.styles.length; i++) {
      const style = record.styles[i];

      const styleItalic = style.italic ?? false;
      const styleWeight = style.weight ?? 400;

      if (styleItalic !== italic && hasItalicMatch) {
        continue;
      }

      const distance = Math.abs(styleWeight - weight);

      if (styleItalic === italic) {
        if (!hasItalicMatch || distance < bestDistance) {
          hasItalicMatch = true;
          bestDistance = distance;
          bestStyleIndex = i;
        }
      } else if (distance < bestDistance) {
        bestDistance = distance;
        bestStyleIndex = i;
      }
    }

    return new MatchedFont(record, bestStyleIndex);
  }
}

function addCssFontFace(name: string, url: string): void {
  if (isHeadlessMode) {
    return;
  }

  const style = document.createElement("style");
  style.innerHTML = `
@font-face {
  font-family: '${name}';
  src: url('${url}') format('truetype');
}
`;
  document.head.appendChild(style);

  document.fonts.load(`12px '${name}'`);
}
