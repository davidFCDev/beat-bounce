/**
 * Color conversion utilities for canvas rendering.
 */

/** Parse a hex color string (#RRGGBB) into { r, g, b } components. Cached. */
const _rgbCache = new Map<string, { r: number; g: number; b: number }>();
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cached = _rgbCache.get(hex);
  if (cached) return cached;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  cached = result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 255, b: 255 };
  _rgbCache.set(hex, cached);
  return cached;
}

/** Cyberpunk neon palette – used throughout multiple systems. */
export const NEON_COLORS = ["#B026FF", "#FFFF00", "#39FF14"] as const;
