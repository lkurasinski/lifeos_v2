import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushSync } from "svelte";
import { debounced } from "./debounced.svelte.js";

// `$effect` only runs under the Svelte client runtime, which Vitest reaches via the
// `resolve.conditions: ["browser"]` knob in vitest.config.ts. `$effect.root` + `flushSync`
// drive the effect synchronously; fake timers advance the debounce window deterministically.
describe("debounced", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("seeds the initial value synchronously (no startup delay)", () => {
		const cleanup = $effect.root(() => {
			const n = $state(7);
			const d = debounced(() => n, 220);
			expect(d.current).toBe(7);
		});
		cleanup();
	});

	it("delays updates until the window elapses, then reflects the latest value", () => {
		const cleanup = $effect.root(() => {
			let n = $state(0);
			const d = debounced(() => n, 220);
			flushSync();

			n = 1;
			flushSync();
			expect(d.current).toBe(0); // still the old value mid-window

			vi.advanceTimersByTime(219);
			flushSync();
			expect(d.current).toBe(0); // not yet — one tick short

			vi.advanceTimersByTime(1);
			flushSync();
			expect(d.current).toBe(1); // window elapsed
		});
		cleanup();
	});

	it("coalesces a burst of changes into a single trailing update", () => {
		const seen: number[] = [];
		const cleanup = $effect.root(() => {
			let n = $state(0);
			const d = debounced(() => n, 220);
			$effect(() => void seen.push(d.current));
			flushSync();

			// Simulate typing "125" — three rapid changes inside the window.
			n = 1;
			flushSync();
			vi.advanceTimersByTime(50);
			n = 12;
			flushSync();
			vi.advanceTimersByTime(50);
			n = 125;
			flushSync();

			// Each intermediate change reset the timer — nothing committed yet.
			expect(d.current).toBe(0);

			vi.advanceTimersByTime(220);
			flushSync();
			expect(d.current).toBe(125);
		});
		cleanup();
		// Only the seed (0) and the single trailing value (125) ever reached a consumer.
		expect(seen).toEqual([0, 125]);
	});

	it("tracks deep mutations read through $state.snapshot", () => {
		const cleanup = $effect.root(() => {
			const rows = $state([{ amount: 10 }, { amount: 20 }]);
			const d = debounced(() => $state.snapshot(rows), 220);
			flushSync();
			expect(d.current.map((r) => r.amount)).toEqual([10, 20]);

			// In-place nested write (the per-keystroke amount mutation pattern).
			rows[0].amount = 125;
			flushSync();
			expect(d.current.map((r) => r.amount)).toEqual([10, 20]); // debounced

			vi.advanceTimersByTime(220);
			flushSync();
			expect(d.current.map((r) => r.amount)).toEqual([125, 20]);
		});
		cleanup();
	});
});
