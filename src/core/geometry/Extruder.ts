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

    // Count side-wall segments (4 vertices + 6 indices per segment)
    let sideSegments = 0;
    if (depth !== 0) {
      for (const contour of geometry.contours) {
        // Contours are closed (last point repeats first)
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
    for (const contour of geometry.contours) {
      for (let i = 0; i < contour.length - 2; i += 2) {
        const p0x = contour[i];
        const p0y = contour[i + 1];
        const p1x = contour[i + 2];
        const p1y = contour[i + 3];

        // Perpendicular normal for this wall segment
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
    }

    return { vertices, normals, indices };
  }
}
