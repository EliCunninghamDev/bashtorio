// ---------------------------------------------------------------------------
// Fast color math - packed 0xRRGGBB integers, no allocations until CSS output
// ---------------------------------------------------------------------------

/** Packed RGB color: 0xRRGGBB */
export type RGB = number;

export function rgb(r: number, g: number, b: number): RGB {
  return (r << 16) | (g << 8) | b;
}

export function hexToRgb(hex: string): RGB {
  return parseInt(hex.slice(1), 16);
}

export function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const ar = a >> 16, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = b >> 16, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return ((ar + (br - ar) * t) & 0xff) << 16 |
         ((ag + (bg - ag) * t) & 0xff) << 8 |
         ((ab + (bb - ab) * t) & 0xff);
}

export function rgbCSS(c: RGB): string {
  return `rgb(${c >> 16},${(c >> 8) & 0xff},${c & 0xff})`;
}
