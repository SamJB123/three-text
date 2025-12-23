import fs from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const { Text } = require('../dist/index.cjs');
const enUs = require('../dist/patterns/en-us.cjs');

const EXAMPLE_TEXT = `three-text renders and formats text from TTF, OTF, and WOFF font files as 3D geometry. It uses Tex-based parameters for breaking text into paragraphs across multiple lines, and turns font outlines into 3D shapes on the fly, caching their geometries for low CPU overhead in languages with lots of repeating glyphs. Variable fonts are supported as static instances at a given axis coordinate. The library has a framework-agnostic core that returns raw vertex data, with lightweight adapters for Three.js, React Three Fiber, p5.js, WebGL and WebGPU. Under the hood, three-text relies on HarfBuzz for text shaping, Knuth-Plass line breaking, Liang hyphenation, libtess by Eric Veach for removing overlaps and triangulation, curve polygonization from Maxim Shemanarev's Anti-Grain Geometry, and Visvalingam-Whyatt line simplification`;

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function percentile(xs, p) {
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const warmIdx = args.indexOf('--warmup');
const alignIdx = args.indexOf('--align');
const runs = runsIdx >= 0 ? Number(args[runsIdx + 1]) : 8;
const warmup = warmIdx >= 0 ? Number(args[warmIdx + 1]) : 3;
const align = alignIdx >= 0 ? String(args[alignIdx + 1]) : 'justify';

if (!['left', 'center', 'right', 'justify'].includes(align)) {
  console.error('Usage: node bench/benchTextCreate.mjs --align left|center|right|justify');
  process.exit(1);
}

if (!Number.isFinite(runs) || runs <= 0 || !Number.isFinite(warmup) || warmup < 0) {
  console.error('Usage: node bench/benchTextCreate.mjs --warmup 3 --runs 8 --align justify');
  process.exit(1);
}

const hbWasmPath = require.resolve('../node_modules/harfbuzzjs/hb.wasm');
const hbNodeBuffer = fs.readFileSync(hbWasmPath);
const hbArrayBuffer = hbNodeBuffer.buffer.slice(
  hbNodeBuffer.byteOffset,
  hbNodeBuffer.byteOffset + hbNodeBuffer.byteLength
);
Text.setHarfBuzzBuffer(hbArrayBuffer);

const fontPath = require.resolve('../examples/fonts/NimbusSanL-Reg.woff');
const fontNodeBuffer = fs.readFileSync(fontPath);
const fontBuffer = fontNodeBuffer.buffer.slice(
  fontNodeBuffer.byteOffset,
  fontNodeBuffer.byteOffset + fontNodeBuffer.byteLength
);

await Text.init();
Text.registerPattern('en-us', enUs);

const config = {
  text: EXAMPLE_TEXT,
  font: fontBuffer,
  size: 72,
  depth: 7,
  lineHeight: 1.33,
  layout: {
    width: 1400,
    align,
    direction: 'ltr',
    hyphenate: true,
    language: 'en-us'
  }
};

async function runOnce() {
  const t0 = performance.now();
  await Text.create(config);
  const t1 = performance.now();
  return t1 - t0;
}

for (let i = 0; i < warmup; i++) {
  await runOnce();
  process.stdout.write(`Warmup ${i + 1}/${warmup} done\r`);
}
if (warmup > 0) process.stdout.write('\n');

const times = [];
for (let i = 0; i < runs; i++) {
  const dt = await runOnce();
  times.push(dt);
  process.stdout.write(`Run ${i + 1}/${runs} done\r`);
}
process.stdout.write('\n');

const m = mean(times);
const sd = stdev(times);
const cv = m > 0 ? (sd / m) * 100 : 0;
console.log(`Text.create(): mean ${m.toFixed(2)}ms  (sd ${sd.toFixed(2)} / cv ${cv.toFixed(2)}%)  p50 ${percentile(times, 0.5).toFixed(2)}  p95 ${percentile(times, 0.95).toFixed(2)}  n=${times.length}`);


