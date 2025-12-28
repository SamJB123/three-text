import { describe, bench, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WoffConverter } from '../src/core/font/WoffConverter';

let merriweatherBuffer: ArrayBuffer;
let nimbusBuffer: ArrayBuffer;

beforeAll(async () => {
  const merriweatherPath = join(
    __dirname,
    '../examples/fonts/Merriweather-VariableFont_opsz,wdth,wght.woff'
  );
  const merriweatherFile = readFileSync(merriweatherPath);
  merriweatherBuffer = merriweatherFile.buffer.slice(
    merriweatherFile.byteOffset,
    merriweatherFile.byteOffset + merriweatherFile.byteLength
  );

  const nimbusPath = join(
    __dirname,
    '../examples/fonts/NimbusSanL-Reg.woff'
  );
  const nimbusFile = readFileSync(nimbusPath);
  nimbusBuffer = nimbusFile.buffer.slice(
    nimbusFile.byteOffset,
    nimbusFile.byteOffset + nimbusFile.byteLength
  );
});

describe('WoffConverter decompression', () => {
  bench('detectFormat', () => {
    WoffConverter.detectFormat(merriweatherBuffer);
  });

  bench('decompressWoff - Merriweather (large)', async () => {
    await WoffConverter.decompressWoff(merriweatherBuffer);
  });

  bench('decompressWoff - NimbusSans (small)', async () => {
    await WoffConverter.decompressWoff(nimbusBuffer);
  });
});

