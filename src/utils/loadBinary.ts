// Fetch with fs fallback for Electron file:// and Node.js environments
export async function loadBinary(filePath: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.arrayBuffer();
  } catch (fetchError) {
    const req = (globalThis as any).require;
    if (typeof req !== 'function') {
      throw new Error(`Failed to fetch ${filePath}: ${fetchError}`);
    }

    try {
      const fs = req('fs');
      const nodePath = req('path');

      // file:// URLs need path resolution relative to the HTML document
      let resolvedPath = filePath;
      if (
        typeof window !== 'undefined' &&
        window.location?.protocol === 'file:'
      ) {
        const dir = nodePath.dirname(window.location.pathname);
        resolvedPath = nodePath.join(dir, filePath);
      }

      const buffer = fs.readFileSync(resolvedPath);
      if (buffer instanceof ArrayBuffer) return buffer;
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
    } catch (fsError) {
      throw new Error(
        `Failed to load ${filePath}: fetch failed (${fetchError}), fs.readFileSync failed (${fsError})`
      );
    }
  }
}
