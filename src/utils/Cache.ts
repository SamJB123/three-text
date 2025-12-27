// Map-based cache with no eviction policy

export interface CacheStats {
  size: number;
}

export class Cache<K, V> {
  private cache = new Map<K, V>();

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  getStats(): CacheStats {
    return {
      size: this.cache.size
    };
  }
}
