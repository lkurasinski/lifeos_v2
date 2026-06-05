/**
 * Retry an async operation with a fixed delay between attempts — used for the
 * intermittently-flaky OFF CDN. Returns the first success; rethrows the last error
 * after the final attempt fails. `onRetry(n)` fires before each retry (n = the upcoming
 * attempt number, 2..attempts) so a caller can surface progress. The caller decides what
 * is retryable: anything `fn` throws is retried; anything it returns (e.g. a tagged
 * "rate-limited" outcome) short-circuits without a retry. Pure given an injected `sleep`,
 * so the policy is unit-testable without real timers.
 */
export type RetryOptions = {
	attempts: number;
	delayMs: number;
	/** Injectable for tests; defaults to a real setTimeout-based delay. */
	sleep?: (ms: number) => Promise<void>;
	/** Fires before each retry with the upcoming attempt number (2..attempts). */
	onRetry?: (nextAttempt: number) => void;
};

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
	const sleep = opts.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	let lastError: unknown;
	for (let attempt = 1; attempt <= opts.attempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			if (attempt < opts.attempts) {
				opts.onRetry?.(attempt + 1);
				await sleep(opts.delayMs);
			}
		}
	}
	throw lastError;
}
