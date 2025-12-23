import { describe, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Text } from '../src/core/Text';
import { perfLogger } from '../src/utils/PerformanceLogger';
import enUs from '../src/hyphenation/en-us';

const require = createRequire(import.meta.url);

// Long CJK-heavy string to stress CJK itemization
// Uses common CJK ideographs + punctuation to exercise glue rules
const CJK_TEXT =
  '漢字仮名交じり文です。' +
  'これはテスト文章です。' +
  '中文排版測試，包含標點符號。' +
  '한국어문장도포함합니다。' +
  '漢字かな漢字かな漢字かな。'.repeat(200);

let fontBuffer: ArrayBuffer;

describe.runIf(process.env.THREE_TEXT_LOG === 'true')(
  'CJK line break perf (batched widths)',
  () => {
    it('runs layout and prints LineBreak timings', async () => {
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
      Text.registerPattern('en-us', enUs);

      const iterations = 3;
      const config = {
        text: CJK_TEXT,
        font: fontBuffer,
        size: 72,
        depth: 0,
        layout: {
          width: 600,
          align: 'justify',
          direction: 'ltr',
          hyphenate: false,
          language: 'en-us'
        }
      };

      perfLogger.clear();
      for (let i = 0; i < iterations; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Text.create(config);
      }

      perfLogger.printSummary();
    }, 30000);
  }
);
