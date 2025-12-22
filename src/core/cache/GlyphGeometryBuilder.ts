import { Vec2, Vec3 } from '../vectors';
import { perfLogger } from '../../utils/PerformanceLogger';
import {
  Path,
  GlyphGeometryInfo,
  GlyphContours,
  LoadedFont,
  GlyphCluster,
  GlyphData
} from '../types';
import {
  globalContourCache,
  globalWordCache,
  globalClusteringCache,
  getGlyphCacheKey
} from './sharedCaches';
import { Tessellator } from '../geometry/Tessellator';
import { Extruder } from '../geometry/Extruder';
import { BoundaryClusterer } from '../geometry/BoundaryClusterer';
import { GlyphContourCollector } from './GlyphContourCollector';
import { getSharedDrawCallbackHandler, DrawCallbackHandler } from '../shaping/DrawCallbacks';
import { CurveFidelityConfig, GeometryOptimizationOptions } from '../types';
import { HarfBuzzGlyph } from '../types';
import { LRUCache } from '../../utils/LRUCache';
import { DEFAULT_CURVE_FIDELITY } from '../geometry/Polygonizer';
import { DEFAULT_OPTIMIZATION_CONFIG } from '../geometry/PathOptimizer';

export interface InstancedTextGeometry {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  glyphInfos: GlyphGeometryInfo[];
  planeBounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

export class GlyphGeometryBuilder {
  private cache: LRUCache<string, GlyphData>;
  private tessellator: Tessellator;
  private extruder: Extruder;
  private fontId: string = 'default';
  private cacheKeyPrefix: string = 'default';
  private curveFidelityConfig?: CurveFidelityConfig;
  private geometryOptimizationOptions?: GeometryOptimizationOptions;
  private clusterer: BoundaryClusterer;
  private collector: GlyphContourCollector;
  private drawCallbacks: DrawCallbackHandler;
  private loadedFont: LoadedFont;
  private wordCache: LRUCache<string, GlyphData>;
  private contourCache: LRUCache<string, GlyphContours>;
  private clusteringCache: LRUCache<string, { glyphIds: number[], groups: number[][] }>;

  constructor(cache: LRUCache<string, GlyphData>, loadedFont: LoadedFont) {
    this.cache = cache;
    this.loadedFont = loadedFont;
    this.tessellator = new Tessellator();
    this.extruder = new Extruder();
    this.clusterer = new BoundaryClusterer();
    this.collector = new GlyphContourCollector();
    this.drawCallbacks = getSharedDrawCallbackHandler(this.loadedFont);
    this.drawCallbacks.createDrawFuncs(this.loadedFont, this.collector);
    this.contourCache = globalContourCache;
    this.wordCache = globalWordCache;
    this.clusteringCache = globalClusteringCache;
  }

  public getOptimizationStats() {
    return this.collector.getOptimizationStats();
  }

  public setCurveFidelityConfig(config?: CurveFidelityConfig): void {
    this.curveFidelityConfig = config;
    this.collector.setCurveFidelityConfig(config);
    this.updateCacheKeyPrefix();
  }

  public setGeometryOptimization(options?: GeometryOptimizationOptions): void {
    this.geometryOptimizationOptions = options;
    this.collector.setGeometryOptimization(options);
    this.updateCacheKeyPrefix();
  }

  public setFontId(fontId: string): void {
    this.fontId = fontId;
    this.updateCacheKeyPrefix();
  }

  private updateCacheKeyPrefix(): void {
    this.cacheKeyPrefix = `${this.fontId}__${this.getGeometryConfigSignature()}`;
  }

  private getGeometryConfigSignature(): string {
    const distanceTolerance =
      this.curveFidelityConfig?.distanceTolerance ??
      DEFAULT_CURVE_FIDELITY.distanceTolerance!;
    const angleTolerance =
      this.curveFidelityConfig?.angleTolerance ??
      DEFAULT_CURVE_FIDELITY.angleTolerance!;

    const enabled =
      this.geometryOptimizationOptions?.enabled ??
      DEFAULT_OPTIMIZATION_CONFIG.enabled;
    const areaThreshold =
      this.geometryOptimizationOptions?.areaThreshold ??
      DEFAULT_OPTIMIZATION_CONFIG.areaThreshold;
    const colinearThreshold =
      this.geometryOptimizationOptions?.colinearThreshold ??
      DEFAULT_OPTIMIZATION_CONFIG.colinearThreshold;
    const minSegmentLength =
      this.geometryOptimizationOptions?.minSegmentLength ??
      DEFAULT_OPTIMIZATION_CONFIG.minSegmentLength;

    // Use fixed precision to keep cache keys stable and avoid float noise
    return [
      `cf:${distanceTolerance.toFixed(4)},${angleTolerance.toFixed(4)}`,
      `opt:${enabled ? 1 : 0},${areaThreshold.toFixed(4)},${colinearThreshold.toFixed(
        6
      )},${minSegmentLength.toFixed(4)}`
    ].join('|');
  }

  // Build instanced geometry from glyph contours
  public buildInstancedGeometry(
    clustersByLine: GlyphCluster[][],
    depth: number,
    removeOverlaps: boolean,
    isCFF: boolean,
    separateGlyphs: boolean = false,
    coloredTextIndices?: Set<number>
  ): InstancedTextGeometry {
    perfLogger.start('GlyphGeometryBuilder.buildInstancedGeometry', {
      lineCount: clustersByLine.length,
      wordCount: clustersByLine.flat().length,
      depth,
      removeOverlaps
    });

    // Growable typed arrays; slice to final size at end
    let vertexBuffer = new Float32Array(1024);
    let normalBuffer = new Float32Array(1024);
    let indexBuffer = new Uint32Array(1024);
    let vertexPos = 0; // float index (multiple of 3)
    let normalPos = 0; // float index (multiple of 3)
    let indexPos = 0; // index count

    const ensureFloatCapacity = (
      buffer: Float32Array<ArrayBuffer>,
      needed: number
    ): Float32Array<ArrayBuffer> => {
      if (needed <= buffer.length) return buffer;
      let nextSize = buffer.length;
      while (nextSize < needed) nextSize *= 2;
      const next = new Float32Array(nextSize);
      next.set(buffer);
      return next;
    };

    const ensureIndexCapacity = (
      buffer: Uint32Array<ArrayBuffer>,
      needed: number
    ): Uint32Array<ArrayBuffer> => {
      if (needed <= buffer.length) return buffer;
      let nextSize = buffer.length;
      while (nextSize < needed) nextSize *= 2;
      const next = new Uint32Array(nextSize);
      next.set(buffer);
      return next;
    };

    const appendGeometryToBuffers = (
      data: GlyphData,
      position: Vec3,
      vertexOffset: number
    ) => {
      const v = data.vertices;
      const n = data.normals;
      const idx = data.indices;

      // Grow buffers as needed
      vertexBuffer = ensureFloatCapacity(vertexBuffer, vertexPos + v.length);
      normalBuffer = ensureFloatCapacity(normalBuffer, normalPos + n.length);
      indexBuffer = ensureIndexCapacity(indexBuffer, indexPos + idx.length);

      // Vertices: translate by position
      const px = position.x;
      const py = position.y;
      const pz = position.z;
      for (let j = 0; j < v.length; j += 3) {
        vertexBuffer[vertexPos++] = v[j] + px;
        vertexBuffer[vertexPos++] = v[j + 1] + py;
        vertexBuffer[vertexPos++] = v[j + 2] + pz;
      }

      // Normals: straight copy
      normalBuffer.set(n, normalPos);
      normalPos += n.length;

      // Indices: copy with vertex offset
      for (let j = 0; j < idx.length; j++) {
        indexBuffer[indexPos++] = idx[j] + vertexOffset;
      }
    };
    const glyphInfos: GlyphGeometryInfo[] = [];

    const planeBounds = {
      min: { x: Infinity, y: Infinity, z: 0 },
      max: { x: -Infinity, y: -Infinity, z: depth }
    };

    for (let lineIndex = 0; lineIndex < clustersByLine.length; lineIndex++) {
      const line = clustersByLine[lineIndex];
      for (const cluster of line) {
        const clusterGlyphContours: GlyphContours[] = [];
        for (const glyph of cluster.glyphs) {
          clusterGlyphContours.push(this.getContoursForGlyph(glyph.g));
        }

        let boundaryGroups: number[][];
        if (cluster.glyphs.length <= 1) {
          boundaryGroups = [[0]];
        } else {
          // Check clustering cache (same text + glyph IDs = same overlap groups)
          // Key must be font-specific; glyph ids/bounds differ between fonts
          const cacheKey = `${this.cacheKeyPrefix}_${cluster.text}`;
          const cached = this.clusteringCache.get(cacheKey);
          
          let isValid = false;
          if (cached && cached.glyphIds.length === cluster.glyphs.length) {
            isValid = true;
            for (let i = 0; i < cluster.glyphs.length; i++) {
              if (cached.glyphIds[i] !== cluster.glyphs[i].g) {
                isValid = false;
                break;
              }
            }
          }

          if (isValid && cached) {
            boundaryGroups = cached.groups;
          } else {
            const relativePositions = cluster.glyphs.map(
              (g) => new Vec3(g.x ?? 0, g.y ?? 0, 0)
            );
            boundaryGroups = this.clusterer.cluster(
              clusterGlyphContours,
              relativePositions
            );
            
            this.clusteringCache.set(cacheKey, {
              glyphIds: cluster.glyphs.map(g => g.g),
              groups: boundaryGroups
            });
          }
        }

        const clusterHasColoredGlyphs =
          coloredTextIndices &&
          cluster.glyphs.some((g) =>
            coloredTextIndices.has(g.absoluteTextIndex)
          );

        // Use glyph-level caching when separateGlyphs is set or when cluster contains colored text
        const forceSeparate = separateGlyphs || clusterHasColoredGlyphs;

        // Iterate over the geometric groups identified by BoundaryClusterer
        // logical groups (words) are now split into geometric sub-groups (e.g. "aa", "XX", "bb")
        for (const groupIndices of boundaryGroups) {
          const isOverlappingGroup = groupIndices.length > 1;
          const shouldCluster = isOverlappingGroup && !forceSeparate;

          if (shouldCluster) {
            // Cluster-level caching for this specific group of overlapping glyphs
            const subClusterGlyphs = groupIndices.map((i) => cluster.glyphs[i]);
            const clusterKey = this.getClusterKey(
              subClusterGlyphs,
              depth,
              removeOverlaps
            );

            let cachedCluster = this.wordCache.get(clusterKey);

            if (!cachedCluster) {
              const clusterPaths: Path[] = [];
              const refX = subClusterGlyphs[0].x ?? 0;
              const refY = subClusterGlyphs[0].y ?? 0;

              for (let i = 0; i < groupIndices.length; i++) {
                const originalIndex = groupIndices[i];
                const glyphContours = clusterGlyphContours[originalIndex];
                const glyph = cluster.glyphs[originalIndex];

                const relX = (glyph.x ?? 0) - refX;
                const relY = (glyph.y ?? 0) - refY;

                for (const path of glyphContours.paths) {
                  clusterPaths.push({
                    ...path,
                    points: path.points.map(
                      (p) => new Vec2(p.x + relX, p.y + relY)
                    )
                  });
                }
              }
              cachedCluster = this.tessellateGlyphCluster(
                clusterPaths,
                depth,
                isCFF
              );
              this.wordCache.set(clusterKey, cachedCluster);
            }

            // Calculate the absolute position of this sub-cluster based on its first glyph

            // (since the cached geometry is relative to that first glyph)
            const firstGlyphInGroup = subClusterGlyphs[0];
            const groupPosition = new Vec3(
              cluster.position.x + (firstGlyphInGroup.x ?? 0),
              cluster.position.y + (firstGlyphInGroup.y ?? 0),
              cluster.position.z
            );

            const vertexOffset = vertexPos / 3;
            appendGeometryToBuffers(cachedCluster, groupPosition, vertexOffset);

            const clusterVertexCount = cachedCluster.vertices.length / 3;

            for (let i = 0; i < groupIndices.length; i++) {
              const originalIndex = groupIndices[i];
              const glyph = cluster.glyphs[originalIndex];
              const glyphContours = clusterGlyphContours[originalIndex];

              const absoluteGlyphPosition = new Vec3(
                cluster.position.x + (glyph.x ?? 0),
                cluster.position.y + (glyph.y ?? 0),
                cluster.position.z
              );

              const glyphInfo = this.createGlyphInfo(
                glyph,
                vertexOffset,
                clusterVertexCount,
                absoluteGlyphPosition,
                glyphContours,
                depth
              );
              glyphInfos.push(glyphInfo);
              this.updatePlaneBounds(glyphInfo.bounds, planeBounds);
            }
          } else {
            // Glyph-level caching (standard path for isolated glyphs or when forced separate)
            for (const i of groupIndices) {
              const glyph = cluster.glyphs[i];
              const glyphContours = clusterGlyphContours[i];
              const glyphPosition = new Vec3(
                cluster.position.x + (glyph.x ?? 0),
                cluster.position.y + (glyph.y ?? 0),
                cluster.position.z
              );

              // Skip glyphs with no paths (spaces, zero-width characters, etc.)
              if (glyphContours.paths.length === 0) {
                const glyphInfo = this.createGlyphInfo(
                  glyph,
                  0,
                  0,
                  glyphPosition,
                  glyphContours,
                  depth
                );
                glyphInfos.push(glyphInfo);
                continue;
              }

              let cachedGlyph = this.cache.get(
                getGlyphCacheKey(this.cacheKeyPrefix, glyph.g, depth, removeOverlaps)
              );

              if (!cachedGlyph) {
                cachedGlyph = this.tessellateGlyph(
                  glyphContours,
                  depth,
                  removeOverlaps,
                  isCFF
                );
                this.cache.set(
                  getGlyphCacheKey(this.cacheKeyPrefix, glyph.g, depth, removeOverlaps),
                  cachedGlyph
                );
              } else {
                cachedGlyph.useCount++;
              }

              const vertexOffset = vertexPos / 3;
              appendGeometryToBuffers(cachedGlyph, glyphPosition, vertexOffset);

              const glyphInfo = this.createGlyphInfo(
                glyph,
                vertexOffset,
                cachedGlyph.vertices.length / 3,
                glyphPosition,
                glyphContours,
                depth
              );
              glyphInfos.push(glyphInfo);
              this.updatePlaneBounds(glyphInfo.bounds, planeBounds);
            }
          }
        }
      }
    }

    // Slice to used lengths (avoid returning oversized buffers)
    const vertexArray = vertexBuffer.slice(0, vertexPos);
    const normalArray = normalBuffer.slice(0, normalPos);
    const indexArray = indexBuffer.slice(0, indexPos);

    perfLogger.end('GlyphGeometryBuilder.buildInstancedGeometry');

    return {
      vertices: vertexArray,
      normals: normalArray,
      indices: indexArray,
      glyphInfos,
      planeBounds
    };
  }

  private getClusterKey(
    glyphs: HarfBuzzGlyph[],
    depth: number,
    removeOverlaps: boolean
  ): string {
    if (glyphs.length === 0) return '';

    // Normalize positions relative to the first glyph in the cluster
    const refX = glyphs[0].x ?? 0;
    const refY = glyphs[0].y ?? 0;

    const parts = glyphs.map((g) => {
      const relX = (g.x ?? 0) - refX;
      const relY = (g.y ?? 0) - refY;
      return `${g.g}:${relX},${relY}`;
    });

    const ids = parts.join('|');
    const roundedDepth = Math.round(depth * 1000) / 1000;
    return `${this.cacheKeyPrefix}_${ids}_${roundedDepth}_${removeOverlaps}`;
  }

  private createGlyphInfo(
    glyph: HarfBuzzGlyph,
    vertexStart: number,
    vertexCount: number,
    position: Vec3,
    contours: GlyphContours,
    depth: number
  ): GlyphGeometryInfo {
    return {
      textIndex: glyph.absoluteTextIndex,
      lineIndex: glyph.lineIndex,
      vertexStart,
      vertexCount,
      bounds: {
        min: {
          x: contours.bounds.min.x + position.x,
          y: contours.bounds.min.y + position.y,
          z: position.z
        },
        max: {
          x: contours.bounds.max.x + position.x,
          y: contours.bounds.max.y + position.y,
          z: position.z + depth
        }
      }
    };
  }

  private getContoursForGlyph(glyphId: number): GlyphContours {
    const key = `${this.cacheKeyPrefix}_${glyphId}`;
    const cached = this.contourCache.get(key);
    if (cached) {
      return cached;
    }

    // Rebind collector before draw operation
    this.drawCallbacks.setCollector(this.collector);
    
    this.collector.reset();
    this.collector.beginGlyph(glyphId, 0);
    this.loadedFont.module.exports.hb_font_draw_glyph(
      this.loadedFont.font.ptr,
      glyphId,
      this.drawCallbacks.getDrawFuncsPtr(),
      0
    );
    this.collector.finishGlyph();
    const collected = this.collector.getCollectedGlyphs()[0];

    const contours = collected || {
      glyphId,
      paths: [],
      bounds: {
        min: { x: 0, y: 0 },
        max: { x: 0, y: 0 }
      }
    };

    this.contourCache.set(key, contours);
    return contours;
  }

  private tessellateGlyphCluster(
    paths: Path[],
    depth: number,
    isCFF: boolean
  ): GlyphData {
    const processedGeometry = this.tessellator.process(paths, true, isCFF);
    return this.extrudeAndPackage(processedGeometry, depth);
  }

  private extrudeAndPackage(processedGeometry: any, depth: number): GlyphData {
    perfLogger.start('Extruder.extrude', {
      depth,
      upem: this.loadedFont.upem
    });
    const extrudedResult = this.extruder.extrude(
      processedGeometry,
      depth,
      this.loadedFont.upem
    );
    perfLogger.end('Extruder.extrude');

    // Compute bounding box from vertices
    const vertices = extrudedResult.vertices;
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2];

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    const boundsMin = new Vec3(minX, minY, minZ);
    const boundsMax = new Vec3(maxX, maxY, maxZ);

    return {
      geometry: processedGeometry,
      vertices: extrudedResult.vertices,
      normals: extrudedResult.normals,
      indices: extrudedResult.indices,
      bounds: { min: boundsMin, max: boundsMax },
      useCount: 1
    };
  }

  // Tessellate a glyph for caching
  private tessellateGlyph(
    glyphContours: GlyphContours,
    depth: number,
    removeOverlaps: boolean,
    isCFF: boolean
  ): GlyphData {
    perfLogger.start('GlyphGeometryBuilder.tessellateGlyph', {
      glyphId: glyphContours.glyphId,
      pathCount: glyphContours.paths.length
    });
    const processedGeometry = this.tessellator.process(
      glyphContours.paths,
      removeOverlaps,
      isCFF
    );
    perfLogger.end('GlyphGeometryBuilder.tessellateGlyph');

    return this.extrudeAndPackage(processedGeometry, depth);
  }

  private updatePlaneBounds(
    glyphBounds: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    },
    planeBounds: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    }
  ): void {
    const pMin = planeBounds.min;
    const pMax = planeBounds.max;
    const gMin = glyphBounds.min;
    const gMax = glyphBounds.max;

    if (gMin.x < pMin.x) pMin.x = gMin.x;
    if (gMin.y < pMin.y) pMin.y = gMin.y;
    if (gMin.z < pMin.z) pMin.z = gMin.z;

    if (gMax.x > pMax.x) pMax.x = gMax.x;
    if (gMax.y > pMax.y) pMax.y = gMax.y;
    if (gMax.z > pMax.z) pMax.z = gMax.z;
  }

  public getCacheStats() {
    return this.cache.getStats();
  }

  public clearCache() {
    this.cache.clear();
    this.wordCache.clear();
    this.clusteringCache.clear();
    this.contourCache.clear();
  }
}
