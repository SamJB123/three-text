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

    // Count side-wall segments (each segment emits 4 vertices + 6 indices)
    let sideSegments = 0;
    if (depth !== 0) {
      for (const contour of geometry.contours) {
        // Each contour is a flat [x0,y0,x1,y1,...] array; side walls connect consecutive points
        // Contours are expected to be closed (last point repeats first), so segments = (nPoints - 1)
        const contourPoints = contour.length / 2;
        if (contourPoints >= 2) sideSegments += contourPoints - 1;
      }
    }

    const sideVertexCount = depth === 0 ? 0 : sideSegments * 4;
    const baseVertexCount = depth === 0 ? numPoints : numPoints * 2;
    const vertexCount = baseVertexCount + sideVertexCount;

    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);

    const indexCount =
      depth === 0
        ? triangleIndices.length
        : triangleIndices.length * 2 + sideSegments * 6;
    const indices = new Uint32Array(indexCount);

    if (depth === 0) {
      // Flat faces only
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

      for (let i = 0; i < triangleIndices.length; i++) {
        indices[i] = triangleIndices[i];
      }

      return { vertices, normals, indices };
    }

    // Front/back faces
    const minBackOffset = unitsPerEm * 0.000025;
    const backZ = depth <= minBackOffset ? minBackOffset : depth;

    // Fill front vertices/normals (0..numPoints-1)
    for (let p = 0, vi = 0; p < points.length; p += 2, vi++) {
      const base = vi * 3;
      vertices[base] = points[p];
      vertices[base + 1] = points[p + 1];
      vertices[base + 2] = 0;

      normals[base] = 0;
      normals[base + 1] = 0;
      normals[base + 2] = 1;
    }

    // Fill back vertices/normals (numPoints..2*numPoints-1)
    for (let p = 0, vi = 0; p < points.length; p += 2, vi++) {
      const base = (numPoints + vi) * 3;
      vertices[base] = points[p];
      vertices[base + 1] = points[p + 1];
      vertices[base + 2] = backZ;

      normals[base] = 0;
      normals[base + 1] = 0;
      normals[base + 2] = -1;
    }

    // Front indices
    for (let i = 0; i < triangleIndices.length; i++) {
      indices[i] = triangleIndices[i];
    }

    // Back indices (reverse winding + offset)
    for (let i = 0; i < triangleIndices.length; i++) {
      indices[triangleIndices.length + i] =
        triangleIndices[triangleIndices.length - 1 - i] + numPoints;
    }

    // Side walls
    let nextVertex = numPoints * 2;
    let idxPos = triangleIndices.length * 2;
    for (const contour of geometry.contours) {
      for (let i = 0; i < contour.length - 2; i += 2) {
        const p0x = contour[i];
        const p0y = contour[i + 1];
        const p1x = contour[i + 2];
        const p1y = contour[i + 3];

        // Unit normal for the wall quad (per-edge)
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

        // 4 vertices (two at z=0, two at z=depth)
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

        // Normals (same for all 4 wall vertices)
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

        // Indices (two triangles)
        indices[idxPos++] = baseVertex;
        indices[idxPos++] = baseVertex + 1;
        indices[idxPos++] = baseVertex + 2;
        indices[idxPos++] = baseVertex + 1;
        indices[idxPos++] = baseVertex + 3;
        indices[idxPos++] = baseVertex + 2;

        nextVertex += 4;
      }
    }

    return { vertices, normals, indices };
  }
}
