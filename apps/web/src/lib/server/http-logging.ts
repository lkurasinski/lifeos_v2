import { logger } from "./logger.js";

/**
 * HTTP logging helpers shared by the layer instrumentation. Body logging itself lives in the
 * request hook (`hooks.server.ts`, via `capBody`) and the Meili transport (`search.ts`); this
 * module owns the size cap and the raw-`fetch` egress wrapper. Every line is correlated to the
 * request's summary line by `reqId`, injected by the logger's request-context mixin, and the
 * logger's `redact` masks secret fields.
 */

/** Bodies whose serialized size exceeds this are logged as a summary, not in full. */
const BODY_LOG_CAP_BYTES = 10_000;

/**
 * Cap a body for logging: small payloads (request DTOs, Meili queries) pass through and stay
 * redacted by the logger; large ones (e.g. catalog search responses) collapse to a
 * `{ truncated, bytes }` summary. No raw preview slice — a slice would bypass the logger's
 * key-based redaction. Used by the request hook (request/response bodies) and the Meili
 * transport (request payloads).
 */
export function capBody(body: unknown): unknown {
	let serialized: string;
	try {
		serialized = JSON.stringify(body);
	} catch {
		return { unserializable: true };
	}
	if (serialized === undefined || serialized.length <= BODY_LOG_CAP_BYTES) return body;
	return { truncated: true, bytes: serialized.length };
}

/* ── Egress logging ──────────────────────────────────────────────────────────
 * Outbound dependency calls, the complement to inbound request logging. Each
 * inherits `reqId` via the request-context mixin when called inside a request.
 * Success → `debug` (with duration), failure → `warn` (rethrown unchanged).
 * Meili egress is covered by the client's injected `httpClient` (search.ts);
 * this wrapper covers raw `fetch` callers (OFF). */

/**
 * `fetch` wrapper that logs the outbound HTTP call. Logs status + duration on completion,
 * a `warn` on network/timeout failure, and returns the `Response` untouched (body not read).
 */
export async function loggedFetch(
	input: string | URL | Request,
	init?: RequestInit,
	meta?: Record<string, unknown>,
): Promise<Response> {
	const method = init?.method ?? (input instanceof Request ? input.method : "GET");
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	const start = performance.now();
	try {
		const res = await fetch(input, init);
		const fields = {
			...meta,
			method,
			url,
			status: res.status,
			ms: Math.round(performance.now() - start),
		};
		// A completed fetch with a non-2xx status is still a failure worth seeing at the
		// default level — escalate to warn, mirroring the inbound request line.
		if (res.ok) logger.debug(fields, "fetch");
		else logger.warn(fields, "fetch");
		return res;
	} catch (err) {
		logger.warn(
			{ ...meta, method, url, err, ms: Math.round(performance.now() - start) },
			"fetch failed",
		);
		throw err;
	}
}
