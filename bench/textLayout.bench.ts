import { describe, bench } from 'vitest';
import { TextLayout } from '../src/core/layout/TextLayout';

function makeVertices(vertexCount: number): Float32Array {
  const vertices = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const base = i * 3;
    vertices[base] = i % 1000;
    vertices[base + 1] = (i % 97) - 48;
    vertices[base + 2] = 0;
  }
  return vertices;
}

const vertexCount = 100_000;
const vertices = makeVertices(vertexCount);

const planeBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 1000, y: 0, z: 0 }
};

const width = 1400;

// applyAlignment does not use loadedFont, but the class requires it
const layout = new TextLayout({} as any);

describe('TextLayout performance', () => {
  bench('applyAlignment left vertices(100k)', () => {
    layout.applyAlignment(vertices, { width, align: 'left', planeBounds });
  });

  bench('applyAlignment center vertices(100k)', () => {
    layout.applyAlignment(vertices, { width, align: 'center', planeBounds });
  });

  bench('applyAlignment right vertices(100k)', () => {
    layout.applyAlignment(vertices, { width, align: 'right', planeBounds });
  });
});
