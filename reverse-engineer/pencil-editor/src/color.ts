export function getColorLuminance(r: number, g: number, b: number): number {
  const sR = r / 255;
  const sG = g / 255;
  const sB = b / 255;

  const rLinear =
    sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4);
  const gLinear =
    sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4);
  const bLinear =
    sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

export function getContrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastingFillColor(pixel: Uint8Array): string {
  const luminance = getColorLuminance(pixel[0], pixel[1], pixel[2]);
  const blackContrast = getContrastRatio(luminance, 0);
  const whiteContrast = getContrastRatio(luminance, 1);
  return blackContrast > whiteContrast ? "#000000" : "#ffffff";
}
