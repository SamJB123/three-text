import type { ProcessedGeometry } from '../types';

export interface ExtrusionResult {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export class Extruder {
  constructor() {}

  private packEdge(a: number, b: number): number {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    return lo * 0x100000000 + hi;
  }

  public extrude(
    geometry: ProcessedGeometry,
    depth: number = 0,
    unitsPerEm: number
  ): ExtrusionResult {
    const points = geometry.triangles.vertices;
    const triangleIndices = geometry.triangles.indices;
    const numPoints = points.length / 2;

    // Count boundary edges for side walls (4 vertices + 6 indices per edge)
    let boundaryEdges: Array<[number, number]> = [];
    if (depth !== 0) {
      const counts = new Map<number, number>();
      const oriented = new Map<number, [number, number]>();

      for (let i = 0; i < triangleIndices.length; i += 3) {
        const a = triangleIndices[i];
        const b = triangleIndices[i + 1];
        const c = triangleIndices[i + 2];

        const k0 = this.packEdge(a, b);
        const n0 = (counts.get(k0) ?? 0) + 1;
        counts.set(k0, n0);
        if (n0 === 1) oriented.set(k0, [a, b]);

        const k1 = this.packEdge(b, c);
        const n1 = (counts.get(k1) ?? 0) + 1;
        counts.set(k1, n1);
        if (n1 === 1) oriented.set(k1, [b, c]);

        const k2 = this.packEdge(c, a);
        const n2 = (counts.get(k2) ?? 0) + 1;
        counts.set(k2, n2);
        if (n2 === 1) oriented.set(k2, [c, a]);
      }

      boundaryEdges = [];
      for (const [key, count] of counts) {
        if (count !== 1) continue;
        const edge = oriented.get(key);
        if (edge) boundaryEdges.push(edge);
      }
    }

    const sideEdgeCount = depth === 0 ? 0 : boundaryEdges.length;
    const sideVertexCount = depth === 0 ? 0 : sideEdgeCount * 4;
    const baseVertexCount = depth === 0 ? numPoints : numPoints * 2;
    const vertexCount = baseVertexCount + sideVertexCount;

    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);

    const indexCount =
      depth === 0
        ? triangleIndices.length
        : triangleIndices.length * 2 + sideEdgeCount * 6;
    const indices = new Uint32Array(indexCount);

    if (depth === 0) {
      // Single-sided flat geometry at z=0
      let vPos = 0;
      for (let i = 0; i < points.length; i += 2) {
        vertices[vPos] = points[i];
        vertices[vPos + 1] = points[i + 1];
        vertices[vPos + 2] = 0;

        normals[vPos] = 0;
        normals[vPos + 1] = 0;
        normals[vPos + 2] = 1;
        vPos += 3;
      }

      // libtess outputs CCW, use as-is for +Z facing geometry
      for (let i = 0; i < triangleIndices.length; i++) {
        indices[i] = triangleIndices[i];
      }

      return { vertices, normals, indices };
    }

    // Extruded geometry: front at z=0, back at z=depth
    const minBackOffset = unitsPerEm * 0.000025;
    const backZ = depth <= minBackOffset ? minBackOffset : depth;

    // Generate both caps in one pass
    for (let p = 0, vi = 0; p < points.length; p += 2, vi++) {
      const x = points[p];
      const y = points[p + 1];

      // Cap at z=0
      const base0 = vi * 3;
      vertices[base0] = x;
      vertices[base0 + 1] = y;
      vertices[base0 + 2] = 0;
      normals[base0] = 0;
      normals[base0 + 1] = 0;
      normals[base0 + 2] = -1;

      // Cap at z=depth
      const baseD = (numPoints + vi) * 3;
      vertices[baseD] = x;
      vertices[baseD + 1] = y;
      vertices[baseD + 2] = backZ;
      normals[baseD] = 0;
      normals[baseD + 1] = 0;
      normals[baseD + 2] = 1;
    }

    // libtess outputs CCW triangles (viewed from +Z)
    // Z=0 cap faces -Z, reverse winding
    for (let i = 0; i < triangleIndices.length; i++) {
      indices[i] = triangleIndices[triangleIndices.length - 1 - i];
    }

    // Z=depth cap faces +Z, use original winding
    for (let i = 0; i < triangleIndices.length; i++) {
      indices[triangleIndices.length + i] = triangleIndices[i] + numPoints;
    }

    // Side walls
    let nextVertex = numPoints * 2;
    let idxPos = triangleIndices.length * 2;
    for (let e = 0; e < boundaryEdges.length; e++) {
      const [u, v] = boundaryEdges[e];
      const u2 = u * 2;
      const v2 = v * 2;
      const p0x = points[u2];
      const p0y = points[u2 + 1];
      const p1x = points[v2];
      const p1y = points[v2 + 1];

      // Perpendicular normal for this wall segment
      // Uses the edge direction from the cap triangulation so winding does not depend on contour direction
      const ex = p1x - p0x;
      const ey = p1y - p0y;
      const lenSq = ex * ex + ey * ey;
      let nx = 0;
      let ny = 0;
      if (lenSq > 0) {
        const invLen = 1 / Math.sqrt(lenSq);
        nx = ey * invLen;
        ny = -ex * invLen;
      }

      const baseVertex = nextVertex;
      const base = baseVertex * 3;

      // Wall quad: front edge at z=0, back edge at z=depth
      vertices[base] = p0x;
      vertices[base + 1] = p0y;
      vertices[base + 2] = 0;

      vertices[base + 3] = p1x;
      vertices[base + 4] = p1y;
      vertices[base + 5] = 0;

      vertices[base + 6] = p0x;
      vertices[base + 7] = p0y;
      vertices[base + 8] = backZ;

      vertices[base + 9] = p1x;
      vertices[base + 10] = p1y;
      vertices[base + 11] = backZ;

      // Wall normals point perpendicular to edge
      normals[base] = nx;
      normals[base + 1] = ny;
      normals[base + 2] = 0;

      normals[base + 3] = nx;
      normals[base + 4] = ny;
      normals[base + 5] = 0;

      normals[base + 6] = nx;
      normals[base + 7] = ny;
      normals[base + 8] = 0;

      normals[base + 9] = nx;
      normals[base + 10] = ny;
      normals[base + 11] = 0;

      // Two triangles per wall segment
      indices[idxPos++] = baseVertex;
      indices[idxPos++] = baseVertex + 1;
      indices[idxPos++] = baseVertex + 2;
      indices[idxPos++] = baseVertex + 1;
      indices[idxPos++] = baseVertex + 3;
      indices[idxPos++] = baseVertex + 2;

      nextVertex += 4;
    }

    return { vertices, normals, indices };
  }
}
