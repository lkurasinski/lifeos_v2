import { json } from "@sveltejs/kit";
import { logger } from "./logger.js";

/**
 * HTTP body logging helpers. Both log already-in-hand objects at `debug` — no stream is
 * read or cloned — so they are safe alongside streaming responses. Each entry is correlated
 * to the request's summary line by `reqId`, injected by the logger's request-context mixin.
 * The logger's `redact` masks secret fields in both directions.
 */

/** Log a parsed request payload at `debug`. Call right after a successful `schema.parse(...)`. */
export function logRequestBody(body: unknown): void {
	logger.debug({ body }, "request body");
}

/**
 * Drop-in for SvelteKit's `json(...)` that also logs the response payload at `debug` as a
 * separate entry. Same signature and return as `json`, so call sites just swap the name.
 */
export function jsonLogged(data: unknown, init?: ResponseInit): Response {
	logger.debug({ body: data }, "response body");
	return json(data, init);
}
