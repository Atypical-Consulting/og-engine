export class LRUCache<K, V> {
  private map = new Map<K, V>();
  private readonly max: number;

  constructor(max = 1000) {
    this.max = max;
  }

  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      // Move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: K, val: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      // Evict oldest
      const first = this.map.keys().next().value!;
      this.map.delete(first);
    }
    this.map.set(key, val);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
