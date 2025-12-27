export function evictOldestCacheEntries<T>(cache: Map<string, T>, maxSize: number): void {
	if (cache.size > maxSize) {
		const entries = Array.from(cache.entries());
		const toDelete = entries.slice(0, cache.size - maxSize);
		for (const [key] of toDelete) {
			cache.delete(key);
		}
	}
}
