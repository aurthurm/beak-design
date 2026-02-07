// RGBA color type
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// HSL color type
export interface HslColor {
  h: number;
  s: number;
  l: number;
  a: number;
}

// HSB color type
export interface HsbColor {
  h: number;
  s: number;
  b: number;
  a: number;
}

// Helper functions to convert between different color formats
export const hexToRgba = (hex: string): RgbaColor => {
  if (!hex || typeof hex !== "string") {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  // Remove # if present
  let cleanHex = hex.startsWith("#") ? hex.slice(1) : hex;

  // Handle 3-character hex
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  // Handle 6-character hex (no alpha)
  if (cleanHex.length === 6) {
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
    if (result) {
      return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 1,
      };
    }
  }

  // Handle 8-character hex (with alpha)
  if (cleanHex.length === 8) {
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
      cleanHex,
    );
    if (result) {
      return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: parseInt(result[4], 16) / 255,
      };
    }
  }

  return { r: 0, g: 0, b: 0, a: 1 };
};

export const rgbaToHex = (
  rgba: RgbaColor,
  includeAlpha: boolean = false,
): string => {
  const r = Math.round(rgba.r).toString(16).padStart(2, "0");
  const g = Math.round(rgba.g).toString(16).padStart(2, "0");
  const b = Math.round(rgba.b).toString(16).padStart(2, "0");

  if (includeAlpha) {
    const a = Math.round(rgba.a * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${r}${g}${b}${a}`;
  }

  return `#${r}${g}${b}`;
};

export const rgbaToCss = (rgba: RgbaColor): string => {
  return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${rgba.a})`;
};

export const cssToRgba = (css: string): RgbaColor => {
  const match = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
};

export const rgbaToHsl = (rgba: RgbaColor): HslColor => {
  const r = rgba.r / 255;
  const g = rgba.g / 255;
  const b = rgba.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a: rgba.a,
  };
};

export const hslToRgba = (hsl: HslColor): RgbaColor => {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a: hsl.a,
  };
};

export const rgbaToHsb = (rgba: RgbaColor): HsbColor => {
  const r = rgba.r / 255;
  const g = rgba.g / 255;
  const b = rgba.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const brightness = max;

  if (max !== min) {
    const d = max - min;
    s = max === 0 ? 0 : d / max;

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    b: Math.round(brightness * 100),
    a: rgba.a,
  };
};

export const hsbToRgba = (hsb: HsbColor): RgbaColor => {
  const h = hsb.h / 360;
  const s = hsb.s / 100;
  const b = hsb.b / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, blue;

  if (s === 0) {
    r = g = blue = b;
  } else {
    const q = b < 0.5 ? b * (1 + s) : b + s - b * s;
    const p = 2 * b - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    blue = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(blue * 255),
    a: hsb.a,
  };
};
