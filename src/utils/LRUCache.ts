// Generic LRU (Least Recently Used) cache with optional memory-based eviction

interface LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
}

export interface LRUCacheOptions<K, V> {
  maxEntries?: number;
  maxMemoryBytes?: number;
  calculateSize?: (value: V) => number;
  onEvict?: (key: K, value: V) => void;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
}

export class LRUCache<K, V> {
  private cache = new Map<K, LRUNode<K, V>>();
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    memoryUsage: 0
  };

  private options: Required<Omit<LRUCacheOptions<K, V>, 'onEvict'>> & {
    onEvict?: (key: K, value: V) => void;
  };

  constructor(options: LRUCacheOptions<K, V> = {}) {
    this.options = {
      maxEntries: options.maxEntries ?? Infinity,
      maxMemoryBytes: options.maxMemoryBytes ?? Infinity,
      calculateSize: options.calculateSize ?? (() => 0),
      onEvict: options.onEvict
    };
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);

    if (node) {
      this.stats.hits++;
      this.moveToHead(node);
      return node.value;
    } else {
      this.stats.misses++;
      return undefined;
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  set(key: K, value: V): void {
    // If key already exists, update it
    const existingNode = this.cache.get(key);
    if (existingNode) {
      const oldSize = this.options.calculateSize(existingNode.value);
      const newSize = this.options.calculateSize(value);
      this.stats.memoryUsage = this.stats.memoryUsage - oldSize + newSize;
      existingNode.value = value;
      this.moveToHead(existingNode);
      return;
    }

    const size = this.options.calculateSize(value);

    // Evict entries if we exceed limits
    this.evictIfNeeded(size);

    // Create new node
    const node: LRUNode<K, V> = {
      key,
      value,
      prev: null,
      next: null
    };

    this.cache.set(key, node);
    this.addToHead(node);
    this.stats.size = this.cache.size;
    this.stats.memoryUsage += size;
  }

  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    const size = this.options.calculateSize(node.value);
    this.removeNode(node);
    this.cache.delete(key);
    this.stats.size = this.cache.size;
    this.stats.memoryUsage -= size;

    if (this.options.onEvict) {
      this.options.onEvict(key, node.value);
    }

    return true;
  }

  clear(): void {
    if (this.options.onEvict) {
      for (const [key, node] of this.cache) {
        this.options.onEvict(key, node.value);
      }
    }

    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      memoryUsage: 0
    };
  }

  getStats(): CacheStats & { hitRate: number; memoryUsageMB: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    const memoryUsageMB = this.stats.memoryUsage / (1024 * 1024);

    return {
      ...this.stats,
      hitRate,
      memoryUsageMB
    };
  }

  keys(): K[] {
    const keys: K[] = [];
    let current = this.head;
    while (current) {
      keys.push(current.key);
      current = current.next;
    }
    return keys;
  }

  get size(): number {
    return this.cache.size;
  }

  private evictIfNeeded(requiredSize: number): void {
    // Evict by entry count
    while (this.cache.size >= this.options.maxEntries && this.tail) {
      this.evictTail();
    }

    // Evict by memory usage
    if (this.options.maxMemoryBytes < Infinity) {
      while (
        this.tail &&
        this.stats.memoryUsage + requiredSize > this.options.maxMemoryBytes
      ) {
        this.evictTail();
      }
    }
  }

  private evictTail(): void {
    if (!this.tail) return;

    const nodeToRemove = this.tail;
    const size = this.options.calculateSize(nodeToRemove.value);

    this.removeTail();
    this.cache.delete(nodeToRemove.key);

    this.stats.size = this.cache.size;
    this.stats.memoryUsage -= size;
    this.stats.evictions++;

    if (this.options.onEvict) {
      this.options.onEvict(nodeToRemove.key, nodeToRemove.value);
    }
  }

  private addToHead(node: LRUNode<K, V>): void {
    node.prev = null;
    node.next = null;
    
    if (!this.head) {
      this.head = this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }
  }

  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private removeTail(): void {
    if (this.tail) {
      this.removeNode(this.tail);
    }
  }

  private moveToHead(node: LRUNode<K, V>): void {
    if (node === this.head) return;

    this.removeNode(node);
    this.addToHead(node);
  }
}

