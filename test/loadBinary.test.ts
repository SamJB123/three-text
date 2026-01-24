import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBinary } from '../src/utils/loadBinary';

describe('loadBinary', () => {
  const originalFetch = globalThis.fetch;
  const originalRequire = (globalThis as any).require;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).require = originalRequire;
  });

  it('uses fetch when available and successful', async () => {
    const mockData = new ArrayBuffer(10);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockData)
    });

    const result = await loadBinary('/test.wasm');

    expect(globalThis.fetch).toHaveBeenCalledWith('/test.wasm');
    expect(result).toBe(mockData);
  });

  it('throws on HTTP error when no fs fallback available', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    });
    (globalThis as any).require = undefined;

    await expect(loadBinary('/missing.wasm')).rejects.toThrow('HTTP 404');
  });

  it('falls back to fs.readFileSync when fetch fails', async () => {
    const mockBuffer = Buffer.from([1, 2, 3, 4]);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const mockFs = { readFileSync: vi.fn().mockReturnValue(mockBuffer) };
    const mockPath = { dirname: vi.fn(), join: vi.fn() };
    (globalThis as any).require = vi.fn((mod: string) => {
      if (mod === 'fs') return mockFs;
      if (mod === 'path') return mockPath;
    });

    // No window.location (Node.js environment)
    const result = await loadBinary('./test.wasm');

    expect(mockFs.readFileSync).toHaveBeenCalledWith('./test.wasm');
    expect(result.byteLength).toBe(4);
  });

  it('resolves path relative to HTML for file:// protocol', async () => {
    const mockBuffer = Buffer.from([1, 2, 3]);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('fetch failed'));

    const mockFs = { readFileSync: vi.fn().mockReturnValue(mockBuffer) };
    const mockPath = {
      dirname: vi.fn().mockReturnValue('/app/dist'),
      join: vi.fn().mockReturnValue('/app/dist/hb.wasm')
    };
    (globalThis as any).require = vi.fn((mod: string) => {
      if (mod === 'fs') return mockFs;
      if (mod === 'path') return mockPath;
    });

    // Mock file:// protocol window
    const originalWindow = globalThis.window;
    (globalThis as any).window = {
      location: {
        href: 'file:///app/dist/index.html',
        pathname: '/app/dist/index.html',
        protocol: 'file:'
      }
    };

    try {
      await loadBinary('./hb.wasm');

      expect(mockPath.dirname).toHaveBeenCalledWith('/app/dist/index.html');
      expect(mockPath.join).toHaveBeenCalledWith('/app/dist', './hb.wasm');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/app/dist/hb.wasm');
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  it('throws combined error when both fetch and fs fail', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const mockFs = {
      readFileSync: vi.fn().mockImplementation(() => {
        throw new Error('ENOENT');
      })
    };
    const mockPath = { dirname: vi.fn(), join: vi.fn() };
    (globalThis as any).require = vi.fn((mod: string) => {
      if (mod === 'fs') return mockFs;
      if (mod === 'path') return mockPath;
    });

    await expect(loadBinary('/test.wasm')).rejects.toThrow(
      /fetch failed.*fs.readFileSync failed/
    );
  });
});
