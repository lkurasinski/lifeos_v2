/**
 * Memoize an async loader as a single in-flight promise, RESETTING the cache on rejection so a
 * failed first attempt can retry — a plain promise cache would pin the rejection forever. The
 * returned getter shares one promise across concurrent callers (the per-navigation reference-data
 * loads), then serves the resolved value thereafter.
 *
 * Use for process-lifetime, read-only data that's safe to treat as immutable once loaded: the
 * nutrient registry, the category list, one-time Meili index configuration. Treat the resolved
 * value as read-only — every caller shares the same reference.
 */
export function memoizeAsync<T>(loader: () => Promise<T>): () => Promise<T> {
	let cache: Promise<T> | null = null;
	return () =>
		(cache ??= loader().catch((err) => {
			cache = null;
			throw err;
		}));
}
