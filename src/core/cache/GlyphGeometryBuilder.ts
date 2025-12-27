import { Vec2, Vec3 } from '../vectors';
import { perfLogger } from '../../utils/PerformanceLogger';
import { isLogEnabled } from '../../utils/Logger';
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
import {
  getSharedDrawCallbackHandler,
  DrawCallbackHandler
} from '../shaping/DrawCallbacks';
import { CurveFidelityConfig, GeometryOptimizationOptions } from '../types';
import { HarfBuzzGlyph } from '../types';
import { Cache } from '../../utils/Cache';
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
  private cache: Cache<string, GlyphData>;
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
  private wordCache: Cache<string, GlyphData>;
  private contourCache: Cache<string, GlyphContours>;
  private clusteringCache: Cache<
    string,
    { glyphIds: number[]; groups: number[][] }
  >;
  private emptyGlyphs: Set<number> = new Set();

  constructor(cache: Cache<string, GlyphData>, loadedFont: LoadedFont) {
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
    scale: number,
    separateGlyphs: boolean = false,
    coloredTextIndices?: Set<number>
  ): InstancedTextGeometry {
    if (isLogEnabled) {
      let wordCount = 0;
      for (let i = 0; i < clustersByLine.length; i++) {
        wordCount += clustersByLine[i].length;
      }
      perfLogger.start('GlyphGeometryBuilder.buildInstancedGeometry', {
        lineCount: clustersByLine.length,
        wordCount,
        depth,
        removeOverlaps
      });
    } else {
      perfLogger.start('GlyphGeometryBuilder.buildInstancedGeometry');
    }

    type GeometryTask = {
      data: GlyphData;
      px: number;
      py: number;
      pz: number;
      vertexStart: number; // vertex offset (not float offset)
    };

    const tasks: GeometryTask[] = [];
    let totalVertexFloats = 0;
    let totalNormalFloats = 0;
    let totalIndexCount = 0;
    let vertexCursor = 0; // vertex offset (not float offset)

    const pushTask = (
      data: GlyphData,
      px: number,
      py: number,
      pz: number
    ): number => {
      const vertexStart = vertexCursor;
      tasks.push({ data, px, py, pz, vertexStart });
      totalVertexFloats += data.vertices.length;
      totalNormalFloats += data.normals.length;
      totalIndexCount += data.indices.length;
      vertexCursor += data.vertices.length / 3;
      return vertexStart;
    };
    const glyphInfos: GlyphGeometryInfo[] = [];

    const planeBounds = {
      min: { x: Infinity, y: Infinity, z: 0 },
      max: { x: -Infinity, y: -Infinity, z: depth }
    };

    for (let lineIndex = 0; lineIndex < clustersByLine.length; lineIndex++) {
      const line = clustersByLine[lineIndex];
      for (const cluster of line) {
        const clusterX = cluster.position.x;
        const clusterY = cluster.position.y;
        const clusterZ = cluster.position.z;

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
              glyphIds: cluster.glyphs.map((g) => g.g),
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
        // logical groups (words) split into geometric sub-groups
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
            const groupPosX = clusterX + (firstGlyphInGroup.x ?? 0);
            const groupPosY = clusterY + (firstGlyphInGroup.y ?? 0);
            const groupPosZ = clusterZ;
            const vertexStart = pushTask(
              cachedCluster,
              groupPosX,
              groupPosY,
              groupPosZ
            );

            const clusterVertexCount = cachedCluster.vertices.length / 3;

            for (let i = 0; i < groupIndices.length; i++) {
              const originalIndex = groupIndices[i];
              const glyph = cluster.glyphs[originalIndex];
              const glyphContours = clusterGlyphContours[originalIndex];

              const glyphPosX = clusterX + (glyph.x ?? 0);
              const glyphPosY = clusterY + (glyph.y ?? 0);
              const glyphPosZ = clusterZ;

              const glyphInfo = this.createGlyphInfo(
                glyph,
                vertexStart,
                clusterVertexCount,
                glyphPosX,
                glyphPosY,
                glyphPosZ,
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
              const glyphPosX = clusterX + (glyph.x ?? 0);
              const glyphPosY = clusterY + (glyph.y ?? 0);
              const glyphPosZ = clusterZ;

              // Skip glyphs with no paths (spaces, zero-width characters, etc.)
              if (glyphContours.paths.length === 0) {
                const glyphInfo = this.createGlyphInfo(
                  glyph,
                  0,
                  0,
                  glyphPosX,
                  glyphPosY,
                  glyphPosZ,
                  glyphContours,
                  depth
                );
                glyphInfos.push(glyphInfo);
                continue;
              }

              const glyphCacheKey = getGlyphCacheKey(
                this.cacheKeyPrefix,
                glyph.g,
                depth,
                removeOverlaps
              );
              let cachedGlyph = this.cache.get(glyphCacheKey);

              if (!cachedGlyph) {
                cachedGlyph = this.tessellateGlyph(
                  glyphContours,
                  depth,
                  removeOverlaps,
                  isCFF
                );
                this.cache.set(glyphCacheKey, cachedGlyph);
              } else {
                cachedGlyph.useCount++;
              }

              const vertexStart = pushTask(
                cachedGlyph,
                glyphPosX,
                glyphPosY,
                glyphPosZ
              );

              const glyphInfo = this.createGlyphInfo(
                glyph,
                vertexStart,
                cachedGlyph.vertices.length / 3,
                glyphPosX,
                glyphPosY,
                glyphPosZ,
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

    // Allocate exact-sized buffers and fill once
    const vertexArray = new Float32Array(totalVertexFloats);
    const normalArray = new Float32Array(totalNormalFloats);
    const indexArray = new Uint32Array(totalIndexCount);

    let vertexPos = 0; // float index (multiple of 3)
    let normalPos = 0; // float index (multiple of 3)
    let indexPos = 0; // index count

    for (let t = 0; t < tasks.length; t++) {
      const task = tasks[t];
      const v = task.data.vertices;
      const n = task.data.normals;
      const idx = task.data.indices;

      const px = task.px;
      const py = task.py;
      const pz = task.pz;

      for (let j = 0; j < v.length; j += 3) {
        vertexArray[vertexPos++] = (v[j] + px) * scale;
        vertexArray[vertexPos++] = (v[j + 1] + py) * scale;
        vertexArray[vertexPos++] = (v[j + 2] + pz) * scale;
      }

      normalArray.set(n, normalPos);
      normalPos += n.length;

      const vertexStart = task.vertexStart;
      for (let j = 0; j < idx.length; j++) {
        indexArray[indexPos++] = idx[j] + vertexStart;
      }
    }

    perfLogger.end('GlyphGeometryBuilder.buildInstancedGeometry');

    planeBounds.min.x *= scale;
    planeBounds.min.y *= scale;
    planeBounds.min.z *= scale;
    planeBounds.max.x *= scale;
    planeBounds.max.y *= scale;
    planeBounds.max.z *= scale;

    for (let i = 0; i < glyphInfos.length; i++) {
      glyphInfos[i].bounds.min.x *= scale;
      glyphInfos[i].bounds.min.y *= scale;
      glyphInfos[i].bounds.min.z *= scale;
      glyphInfos[i].bounds.max.x *= scale;
      glyphInfos[i].bounds.max.y *= scale;
      glyphInfos[i].bounds.max.z *= scale;
    }

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
    positionX: number,
    positionY: number,
    positionZ: number,
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
          x: contours.bounds.min.x + positionX,
          y: contours.bounds.min.y + positionY,
          z: positionZ
        },
        max: {
          x: contours.bounds.max.x + positionX,
          y: contours.bounds.max.y + positionY,
          z: positionZ + depth
        }
      }
    };
  }

  private getContoursForGlyph(glyphId: number): GlyphContours {
    // Fast path: skip HarfBuzz draw for known-empty glyphs (spaces, zero-width, etc)
    if (this.emptyGlyphs.has(glyphId)) {
      return {
        glyphId,
        paths: [],
        bounds: {
          min: { x: 0, y: 0 },
          max: { x: 0, y: 0 }
        }
      };
    }

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

    // Mark glyph as empty for future fast-path
    if (contours.paths.length === 0) {
      this.emptyGlyphs.add(glyphId);
    }

    this.contourCache.set(key, contours);
    return contours;
  }

  private tessellateGlyphCluster(
    paths: Path[],
    depth: number,
    isCFF: boolean
  ): GlyphData {
    const processedGeometry = this.tessellator.process(
      paths,
      true,
      isCFF,
      depth !== 0
    );
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
      isCFF,
      depth !== 0
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
