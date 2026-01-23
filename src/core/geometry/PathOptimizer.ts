import { Vec2 } from '../../utils/vectors';
import { MinHeap } from '../../utils/MinHeap';
import type { Path } from '../types';

interface VWPoint {
  index: number;
  area: number;
  prev: VWPoint | null;
  next: VWPoint | null;
}

export interface OptimizationConfig {
  enabled: boolean;
  areaThreshold: number;
}

export interface OptimizationStats {
  pointsRemovedByVisvalingam: number;
  originalPointCount: number;
}

export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  enabled: true,
  areaThreshold: 1.0 // Remove triangles smaller than 1 square font unit
};

export class PathOptimizer {
  private config: OptimizationConfig;
  private stats: OptimizationStats = {
    pointsRemovedByVisvalingam: 0,
    originalPointCount: 0
  };

  constructor(config: OptimizationConfig) {
    this.config = config;
  }

  public setConfig(config: OptimizationConfig) {
    this.config = config;
  }

  public optimizePath(path: Path): Path {
    if (path.points.length <= 2) {
      return path;
    }

    if (!this.config.enabled) {
      return path;
    }

    this.stats.originalPointCount += path.points.length;

    // Most paths are already immutable after collection; avoid copying large point arrays
    // The optimizers below never mutate the input `points` array
    const points = path.points;
    if (points.length < 5) {
      return path;
    }

    let optimized = points;

    // Visvalingam-Whyatt simplification
    optimized = this.simplifyPathVW(optimized, this.config.areaThreshold);
    if (optimized.length < 3) {
      return path;
    }

    return {
      ...path,
      points: optimized
    };
  }

  // Visvalingam-Whyatt algorithm
  private simplifyPathVW(points: Vec2[], areaThreshold: number): Vec2[] {
    if (points.length <= 3) return points;

    const originalLength = points.length;
    const minPoints = 3;

    const pointList: VWPoint[] = points.map((p, i) => ({
      index: i,
      area: Infinity,
      prev: null,
      next: null
    }));

    for (let i = 0; i < pointList.length; i++) {
      pointList[i].prev = pointList[i - 1] || null;
      pointList[i].next = pointList[i + 1] || null;
    }

    const heap = new MinHeap<VWPoint>((a, b) => a.area - b.area);

    for (let i = 1; i < pointList.length - 1; i++) {
      const p = pointList[i];
      p.area = this.calculateTriangleArea(
        points[p.prev!.index],
        points[p.index],
        points[p.next!.index]
      );
      heap.insert(p);
    }

    let remainingPoints = originalLength;
    while (!heap.isEmpty() && remainingPoints > minPoints) {
      const p = heap.extractMin();
      if (!p || p.area > areaThreshold) {
        break;
      }

      if (p.prev) p.prev.next = p.next;
      if (p.next) p.next.prev = p.prev;

      remainingPoints--;
      if (p.prev && p.prev.prev) {
        p.prev.area = this.calculateTriangleArea(
          points[p.prev.prev.index],
          points[p.prev.index],
          points[p.next!.index]
        );
        heap.update(p.prev);
      }

      if (p.next && p.next.next) {
        p.next.area = this.calculateTriangleArea(
          points[p.prev!.index],
          points[p.next.index],
          points[p.next.next.index]
        );
        heap.update(p.next);
      }
    }

    const simplifiedPoints: Vec2[] = [];
    let current: VWPoint | null = pointList[0];
    while (current) {
      simplifiedPoints.push(points[current.index]);
      current = current.next;
    }

    const pointsRemoved = originalLength - simplifiedPoints.length;
    this.stats.pointsRemovedByVisvalingam += pointsRemoved;

    return simplifiedPoints;
  }

  // Shoelace formula
  private calculateTriangleArea(p1: Vec2, p2: Vec2, p3: Vec2): number {
    return Math.abs(
      (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2
    );
  }

  public getStats(): OptimizationStats {
    return { ...this.stats };
  }

  public resetStats(): void {
    this.stats = {
      pointsRemovedByVisvalingam: 0,
      originalPointCount: 0
    };
  }
}
