import { LRUCache } from '../../utils/LRUCache';
import type { GlyphData, GlyphContours } from '../types';

const DEFAULT_CACHE_SIZE_MB = 250;

export function getGlyphCacheKey(
  fontId: string,
  glyphId: number,
  depth: number,
  removeOverlaps: boolean
): string {
  const roundedDepth = Math.round(depth * 1000) / 1000;
  return `${fontId}_${glyphId}_${roundedDepth}_${removeOverlaps}`;
}

export function calculateGlyphMemoryUsage(glyph: GlyphData): number {
  let size = 0;
  size += glyph.vertices.length * 4;
  size += glyph.normals.length * 4;
  size += glyph.indices.length * glyph.indices.BYTES_PER_ELEMENT;
  size += 24; // 2 Vec3s
  size += 256; // Object overhead
  return size;
}

export const globalGlyphCache = new LRUCache<string, GlyphData>({
  maxEntries: Infinity,
  maxMemoryBytes: DEFAULT_CACHE_SIZE_MB * 1024 * 1024,
  calculateSize: calculateGlyphMemoryUsage
});

export function createGlyphCache(
  maxCacheSizeMB: number = DEFAULT_CACHE_SIZE_MB
): LRUCache<string, GlyphData> {
  return new LRUCache<string, GlyphData>({
    maxEntries: Infinity,
    maxMemoryBytes: maxCacheSizeMB * 1024 * 1024,
    calculateSize: calculateGlyphMemoryUsage
  });
}

// Shared across builder instances: contour extraction, word clustering, boundary grouping
export const globalContourCache = new LRUCache<string, GlyphContours>({
  maxEntries: 1000,
  calculateSize: (contours) => {
    let size = 0;
    for (const path of contours.paths) {
      size += path.points.length * 16; // Vec2 = 2 floats * 8 bytes
    }
    return size + 64; // bounds overhead
  }
});

export const globalWordCache = new LRUCache<string, GlyphData>({
  maxEntries: 1000,
  calculateSize: calculateGlyphMemoryUsage
});

export const globalClusteringCache = new LRUCache<
  string,
  { glyphIds: number[]; groups: number[][] }
>({
  maxEntries: 2000,
  calculateSize: () => 1
});
