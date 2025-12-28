import { describe, bench, beforeAll } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Text } from '../src/core/Text';

const require = createRequire(import.meta.url);

const SHORT_TEXT = 'Hello world, this is a test.';
const MEDIUM_TEXT = `The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet. Typography is the art and technique of arranging type to make written language legible, readable and appealing when displayed.`;
const LONG_TEXT = MEDIUM_TEXT.repeat(20);

let fontBuffer: ArrayBuffer;

beforeAll(async () => {
  const hbWasmPath = require.resolve('../node_modules/harfbuzzjs/hb.wasm');
  const hbNodeBuffer = fs.readFileSync(hbWasmPath);
  const hbArrayBuffer = hbNodeBuffer.buffer.slice(
    hbNodeBuffer.byteOffset,
    hbNodeBuffer.byteOffset + hbNodeBuffer.byteLength
  );
  Text.setHarfBuzzBuffer(hbArrayBuffer);

  const fontPath = require.resolve('../examples/fonts/NimbusSanL-Reg.woff');
  const fontNodeBuffer = fs.readFileSync(fontPath);
  fontBuffer = fontNodeBuffer.buffer.slice(
    fontNodeBuffer.byteOffset,
    fontNodeBuffer.byteOffset + fontNodeBuffer.byteLength
  );

  await Text.init();
});

describe('Color/Query Performance', () => {
  describe('Text.create with byText coloring', () => {
    bench('short text, 1 pattern', async () => {
      await Text.create({
        text: SHORT_TEXT,
        font: fontBuffer,
        size: 72,
        color: {
          default: [1, 1, 1],
          byText: { Hello: [1, 0, 0] }
        }
      });
    });

    bench('medium text, 3 patterns', async () => {
      await Text.create({
        text: MEDIUM_TEXT,
        font: fontBuffer,
        size: 72,
        color: {
          default: [1, 1, 1],
          byText: {
            quick: [1, 0, 0],
            fox: [0, 1, 0],
            Typography: [0, 0, 1]
          }
        }
      });
    });

    bench('long text (~4k chars), 5 patterns', async () => {
      await Text.create({
        text: LONG_TEXT,
        font: fontBuffer,
        size: 72,
        color: {
          default: [1, 1, 1],
          byText: {
            quick: [1, 0, 0],
            fox: [0, 1, 0],
            the: [0, 0, 1],
            Typography: [1, 1, 0],
            alphabet: [0, 1, 1]
          }
        }
      });
    });
  });

  describe('Text.create with byCharRange coloring', () => {
    bench('short text, 1 range', async () => {
      await Text.create({
        text: SHORT_TEXT,
        font: fontBuffer,
        size: 72,
        color: {
          default: [1, 1, 1],
          byCharRange: [{ start: 0, end: 5, color: [1, 0, 0] }]
        }
      });
    });

    bench('medium text, 5 ranges', async () => {
      await Text.create({
        text: MEDIUM_TEXT,
        font: fontBuffer,
        size: 72,
        color: {
          default: [1, 1, 1],
          byCharRange: [
            { start: 0, end: 10, color: [1, 0, 0] },
            { start: 20, end: 30, color: [0, 1, 0] },
            { start: 50, end: 60, color: [0, 0, 1] },
            { start: 100, end: 120, color: [1, 1, 0] },
            { start: 150, end: 170, color: [0, 1, 1] }
          ]
        }
      });
    });

    bench('long text, 10 ranges', async () => {
      await Text.create({
        text: LONG_TEXT,
        font: fontBuffer,
        size: 72,
        color: {
          default: [1, 1, 1],
          byCharRange: Array.from({ length: 10 }, (_, i) => ({
            start: i * 400,
            end: i * 400 + 50,
            color: [Math.random(), Math.random(), Math.random()] as [number, number, number]
          }))
        }
      });
    });
  });

  describe('query() function repeated calls', () => {
    bench('query() called 10x on medium text', async () => {
      const result = await Text.create({
        text: MEDIUM_TEXT,
        font: fontBuffer,
        size: 72
      });

      for (let i = 0; i < 10; i++) {
        result.query({ byText: ['quick', 'fox', 'the'] });
      }
    });

    bench('query() called 10x on long text', async () => {
      const result = await Text.create({
        text: LONG_TEXT,
        font: fontBuffer,
        size: 72
      });

      for (let i = 0; i < 10; i++) {
        result.query({ byText: ['quick', 'fox', 'the'] });
      }
    });
  });

  describe('Baseline: no coloring', () => {
    bench('short text, no color', async () => {
      await Text.create({
        text: SHORT_TEXT,
        font: fontBuffer,
        size: 72
      });
    });

    bench('medium text, no color', async () => {
      await Text.create({
        text: MEDIUM_TEXT,
        font: fontBuffer,
        size: 72
      });
    });

    bench('long text, no color', async () => {
      await Text.create({
        text: LONG_TEXT,
        font: fontBuffer,
        size: 72
      });
    });
  });
});

