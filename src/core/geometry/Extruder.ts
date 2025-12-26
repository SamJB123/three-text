import type { ProcessedGeometry } from '../types';

export interface ExtrusionResult {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export class Extruder {
  constructor() {}

  public extrude(
    geometry: ProcessedGeometry,
    depth: number = 0,
    unitsPerEm: number
  ): ExtrusionResult {
    const points = geometry.triangles.vertices;
    const triangleIndices = geometry.triangles.indices;
    const numPoints = points.length / 2;

    // Boundary edges are those that appear in exactly one triangle
    let boundaryEdges: Array<[number, number]> = [];
    if (depth !== 0) {
      // Pack edge pair into integer key: (min << 16) | max
      // Fits glyph vertex indices comfortably, good hash distribution
      const edgeMap = new Map<number, [number, number, number]>();

      const triLen = triangleIndices.length;
      for (let i = 0; i < triLen; i += 3) {
        const a = triangleIndices[i];
        const b = triangleIndices[i + 1];
        const c = triangleIndices[i + 2];

        let key: number, v0: number, v1: number;

        if (a < b) {
          key = (a << 16) | b;
          v0 = a;
          v1 = b;
        } else {
          key = (b << 16) | a;
          v0 = a;
          v1 = b;
        }
        let data = edgeMap.get(key);
        if (data) {
          data[2]++;
        } else {
          edgeMap.set(key, [v0, v1, 1]);
        }

        if (b < c) {
          key = (b << 16) | c;
          v0 = b;
          v1 = c;
        } else {
          key = (c << 16) | b;
          v0 = b;
          v1 = c;
        }
        data = edgeMap.get(key);
        if (data) {
          data[2]++;
        } else {
          edgeMap.set(key, [v0, v1, 1]);
        }

        if (c < a) {
          key = (c << 16) | a;
          v0 = c;
          v1 = a;
        } else {
          key = (a << 16) | c;
          v0 = c;
          v1 = a;
        }
        data = edgeMap.get(key);
        if (data) {
          data[2]++;
        } else {
          edgeMap.set(key, [v0, v1, 1]);
        }
      }

      boundaryEdges = [];
      for (const [v0, v1, count] of edgeMap.values()) {
        if (count === 1) {
          boundaryEdges.push([v0, v1]);
        }
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

      indices.set(triangleIndices);

      return { vertices, normals, indices };
    }

    const minBackOffset = unitsPerEm * 0.000025;
    const backZ = depth <= minBackOffset ? minBackOffset : depth;

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

    // Front cap faces -Z, reverse winding from libtess CCW output
    const triLen = triangleIndices.length;
    for (let i = 0; i < triLen; i++) {
      indices[i] = triangleIndices[triLen - 1 - i];
    }

    // Back cap faces +Z, use original winding
    for (let i = 0; i < triLen; i++) {
      indices[triLen + i] = triangleIndices[i] + numPoints;
    }

    let nextVertex = numPoints * 2;
    let idxPos = triLen * 2;
    const numEdges = boundaryEdges.length;
    
    for (let e = 0; e < numEdges; e++) {
      const edge = boundaryEdges[e];
      const u = edge[0];
      const v = edge[1];
      const u2 = u << 1;
      const v2 = v << 1;
      const p0x = points[u2];
      const p0y = points[u2 + 1];
      const p1x = points[v2];
      const p1y = points[v2 + 1];

      const ex = p1x - p0x;
      const ey = p1y - p0y;
      const lenSq = ex * ex + ey * ey;
      let nx = 0;
      let ny = 0;
      if (lenSq > 1e-10) {
        const invLen = 1 / Math.sqrt(lenSq);
        nx = ey * invLen;
        ny = -ex * invLen;
      }

      const base = nextVertex * 3;

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

      const baseVertex = nextVertex;
      indices[idxPos] = baseVertex;
      indices[idxPos + 1] = baseVertex + 1;
      indices[idxPos + 2] = baseVertex + 2;
      indices[idxPos + 3] = baseVertex + 1;
      indices[idxPos + 4] = baseVertex + 3;
      indices[idxPos + 5] = baseVertex + 2;
      idxPos += 6;

      nextVertex += 4;
    }

    return { vertices, normals, indices };
  }
}
