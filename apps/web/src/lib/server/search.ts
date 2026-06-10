import { Meilisearch } from "meilisearch";
import { MEILISEARCH_HOST, MEILISEARCH_API_KEY } from "$env/static/private";
import { logger } from "$lib/server/logger";
import { capBody } from "$lib/server/http-logging";

/**
 * Logging transport injected as the Meilisearch client's `httpClient`. When `httpClient` is
 * set the SDK delegates the ENTIRE request to it and does NO status checking or JSON parsing of
 * its own (confirmed in `meilisearch` dist: `if (httpClient !== undefined) return await
 * httpClient(url, init)`). So this must replicate the SDK's transport contract exactly:
 *   fetch → res.text() → JSON.parse (empty body → `undefined`) → throw on a non-2xx (carrying
 *   status + parsed body) → return the parsed body.
 * Around that it emits the egress half of the per-request trace — `meili request` (URL +
 * payload) and `meili response` (status + ms) — correlated to the inbound `request` line by the
 * `reqId` the logger's mixin injects. No code path depends on the SDK's `MeiliSearchApiError`
 * type, so a plain status-bearing `Error` is a safe replacement for the SDK's own throw.
 */
const loggingHttpClient = async (...args: Parameters<typeof fetch>): Promise<unknown> => {
	const [input, init] = args;
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	const method = init?.method ?? "GET";
	// The SDK hands us a JSON-stringified body; parse it so the logger's key-based redaction
	// applies and the payload reads as an object (falls back to the raw string if not JSON).
	const payload = parseBody(init?.body);
	// URL goes in `path` so the dev formatter renders it inline in the method → URL column (no
	// message text — the URL identifies the egress line). No status yet → dev shows a `->`.
	logger.debug({ method, path: url, payload: capBody(payload) });

	const start = performance.now();
	const res = await fetch(...args);
	const text = await res.text();
	const body = text === "" ? undefined : JSON.parse(text);
	const ms = Math.round(performance.now() - start);

	// Response: status + ms only (no body — it overlaps the inbound response body, logged by the
	// hook). Status present → dev shows the code in the column instead of `->`.
	const fields = { method, path: url, status: res.status, ms };
	if (res.ok) logger.debug(fields);
	else logger.warn(fields);

	if (!res.ok) {
		throw Object.assign(new Error(`Meilisearch request failed: ${res.status}`), {
			status: res.status,
			body,
		});
	}
	return body;
};

/** Parse a request body for logging only: JSON object when possible, raw string otherwise. */
function parseBody(body: BodyInit | null | undefined): unknown {
	if (typeof body !== "string") return undefined;
	try {
		return JSON.parse(body);
	} catch {
		return body;
	}
}

export const meili = new Meilisearch({
	host: MEILISEARCH_HOST,
	apiKey: MEILISEARCH_API_KEY,
	httpClient: loggingHttpClient,
});
