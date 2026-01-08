import { describe, bench, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FontMetadataExtractor } from '../src/core/font/FontMetadata';
import { WoffConverter } from '../src/core/font/WoffConverter';
import { parseTableDirectory } from '../src/core/font/TableDirectory';

let decompressedBuffer: ArrayBuffer;

beforeAll(async () => {
  const woffPath = join(
    __dirname,
    '../examples/fonts/Merriweather-VariableFont_opsz,wdth,wght.woff'
  );
  const fileBuffer = readFileSync(woffPath);
  const fontBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );
  decompressedBuffer = await WoffConverter.decompressWoff(fontBuffer);
});

describe('FontMetadata extraction', () => {
  bench('parseTableDirectory', () => {
    const view = new DataView(decompressedBuffer);
    parseTableDirectory(view);
  });

  bench('extractMetadata', () => {
    FontMetadataExtractor.extractMetadata(decompressedBuffer);
  });

  bench('extractFeatureTags', () => {
    FontMetadataExtractor.extractFeatureTags(decompressedBuffer);
  });

  bench('extractMetadata + extractFeatureTags', () => {
    FontMetadataExtractor.extractMetadata(decompressedBuffer);
    FontMetadataExtractor.extractFeatureTags(decompressedBuffer);
  });

  bench('extractAll', () => {
    FontMetadataExtractor.extractAll(decompressedBuffer);
  });
});
