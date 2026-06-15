import { untrack } from "svelte";

/**
 * Reactive debounce: mirrors the value produced by `source()` into a debounced copy that
 * only updates `delayMs` after the source last changed. Reads inside `source` are tracked,
 * so any reactive dependency it touches (incl. deep `$state` mutations it reads through)
 * resets the timer. The first value is seeded synchronously, so an initial read is correct
 * with no startup delay — only subsequent changes are coalesced.
 *
 * Use it to throttle an expensive `$derived` recompute without trimming the math: feed the
 * cheap-to-read inputs through `debounced()` and derive off `.current`. Mirrors the 220ms
 * typeahead debounce already used by the product picker.
 *
 * ```ts
 * const input = debounced(() => ({ items: $state.snapshot(items) }), 220);
 * const result = $derived(expensive(input.current.items));
 * ```
 */
export function debounced<T>(source: () => T, delayMs: number): { readonly current: T } {
	let value = $state<T>(untrack(source));
	$effect(() => {
		const next = source();
		const timer = setTimeout(() => {
			value = next;
		}, delayMs);
		return () => clearTimeout(timer);
	});
	return {
		get current() {
			return value;
		},
	};
}
