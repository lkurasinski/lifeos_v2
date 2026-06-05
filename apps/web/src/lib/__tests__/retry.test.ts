// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../retry.js";

// A no-op sleep keeps the policy fast + deterministic (no real timers).
const noSleep = () => Promise.resolve();

describe("withRetry", () => {
	it("returns the first success without retrying", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		const onRetry = vi.fn();
		const result = await withRetry(fn, { attempts: 5, delayMs: 10, sleep: noSleep, onRetry });
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
		expect(onRetry).not.toHaveBeenCalled();
	});

	it("retries on throw and resolves once an attempt succeeds", async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error("net"))
			.mockRejectedValueOnce(new Error("net"))
			.mockResolvedValue("ok");
		const onRetry = vi.fn();
		const result = await withRetry(fn, { attempts: 5, delayMs: 10, sleep: noSleep, onRetry });
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(3);
		// onRetry fires before attempts 2 and 3 with the upcoming attempt number.
		expect(onRetry.mock.calls).toEqual([[2], [3]]);
	});

	it("rethrows the last error after exhausting all attempts", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("boom"));
		const onRetry = vi.fn();
		await expect(withRetry(fn, { attempts: 3, delayMs: 10, sleep: noSleep, onRetry })).rejects.toThrow("boom");
		expect(fn).toHaveBeenCalledTimes(3);
		// Retry announced before attempts 2 and 3, but NOT after the final failure.
		expect(onRetry.mock.calls).toEqual([[2], [3]]);
	});

	it("does not retry a value the fn returns (terminal outcome short-circuits)", async () => {
		const fn = vi.fn().mockResolvedValue({ kind: "rate" });
		const result = await withRetry(fn, { attempts: 5, delayMs: 10, sleep: noSleep });
		expect(result).toEqual({ kind: "rate" });
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
