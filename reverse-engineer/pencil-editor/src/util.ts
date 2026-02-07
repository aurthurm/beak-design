export function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Parses a hex color string and returns the color without alpha and the alpha percentage
 * @param hexColor - Hex color string (3, 6, or 8 characters)
 * @returns Object with color (6-char hex) and alpha (0-100 percentage)
 */
export function parseHexColor(hexColor: string): {
  color: string;
  alpha: number;
} {
  if (!hexColor || typeof hexColor !== "string") {
    return { color: "#000000", alpha: 100 };
  }

  // Remove # if present
  let hex = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;

  // Handle 3-character hex
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  // Handle 6-character hex (no alpha)
  if (hex.length === 6) {
    return { color: `#${hex}`, alpha: 100 };
  }

  // Handle 8-character hex (with alpha)
  if (hex.length === 8) {
    const color = `#${hex.slice(0, 6)}`;
    const alphaHex = hex.slice(6, 8);
    const alphaValue = parseInt(alphaHex, 16);
    const alphaPercentage = Math.round((alphaValue / 255) * 100);
    return { color, alpha: alphaPercentage };
  }

  // Fallback
  return { color: "#000000", alpha: 100 };
}

/**
 * Combines a 6-character hex color with an alpha percentage into an 8-character hex
 * @param color - 6-character hex color string
 * @param alpha - Alpha percentage (0-100)
 * @returns 8-character hex color string with alpha
 */
export function combineColorWithAlpha(color: string, alpha: number): string {
  if (!color || typeof color !== "string") {
    return "#000000";
  }

  // Remove # if present
  let hex = color.startsWith("#") ? color.slice(1) : color;

  // Handle 3-character hex
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  // Ensure we have a 6-character hex
  if (hex.length !== 6) {
    return "#000000";
  }

  // Clamp alpha to 0-100 range
  const clampedAlpha = Math.max(0, Math.min(100, alpha));

  // Convert percentage to 0-255 range
  const alphaValue = Math.round((clampedAlpha / 100) * 255);

  // Convert to hex
  const alphaHex = alphaValue.toString(16).padStart(2, "0");

  return `#${hex}${alphaHex}`;
}

export function assertUnreachable(_value: never): never {
  throw new Error("This should be unreachable!");
}

export function firstAvailableName(
  baseName: string,
  isAvailable: (name: string) => boolean,
): string {
  let name;
  let nameSuffix = 1;
  do {
    name = `${baseName}-${nameSuffix++}`;
  } while (isAvailable(name));
  return name;
}

export function trimNameSuffix(name: string): string {
  const match = name.match(/-[0-9]+$/);
  return match ? name.substring(0, match.index) : name;
}
