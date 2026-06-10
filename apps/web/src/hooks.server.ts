import { building } from "$app/environment";
import { auth } from "$lib/server/auth";
import { validateEnv } from "$lib/server/env";
import { logger } from "$lib/server/logger";
import { capBody } from "$lib/server/http-logging";
import { runWithContext, getReqId } from "$lib/server/request-context";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { sequence } from "@sveltejs/kit/hooks";
import type { Handle, HandleServerError } from "@sveltejs/kit";

validateEnv();

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
	if (!event.url.hostname.includes("localhost")) {
		response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	}
	return response;
};

const handleAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	return svelteKitHandler({ event, resolve, auth, building });
};

/**
 * Clone + parse a request body for debug logging WITHOUT consuming the original stream the
 * endpoint still needs (`.clone()` gives an independent reader). Only JSON and form-urlencoded
 * bodies — this covers JSON API calls and SSR form actions. Multipart, streaming, and any other
 * content type return `undefined` (skipped). A malformed body never breaks the request.
 */
async function readRequestBodyForLog(request: Request): Promise<unknown> {
	const type = request.headers.get("content-type") ?? "";
	try {
		if (type.includes("application/json")) {
			return await request.clone().json();
		}
		if (type.includes("application/x-www-form-urlencoded")) {
			return Object.fromEntries((await request.clone().formData()).entries());
		}
	} catch {
		return undefined;
	}
	return undefined;
}

/**
 * Clone + parse a JSON response body for debug logging. Only `application/json` is read — so
 * streaming responses (AI endpoints, `text/event-stream`) are skipped and a buffering clone
 * never defeats them. A non-JSON or unreadable body returns `undefined` (skipped).
 */
async function readResponseBodyForLog(response: Response): Promise<unknown> {
	const type = response.headers.get("content-type") ?? "";
	if (!type.includes("application/json")) return undefined;
	try {
		return await response.clone().json();
	} catch {
		return undefined;
	}
}

/**
 * Opens a request-scoped `AsyncLocalStorage` context (so every log line in the request —
 * including Prisma and Meili egress logs — inherits a `reqId`) and emits the inbound half of
 * the per-request trace: a `request:start` line on entry, request/response `body` lines at
 * `debug`, and one access `request` line on exit. Body logging is automatic and layer-level —
 * no per-endpoint code — and covers SSR form actions too. Runs innermost so `event.locals.user`
 * is populated by `handleAuth` and the timing covers the real `resolve`. Static asset noise
 * (`/_app/*`, favicon) is skipped entirely; `/api/auth/**` is skipped for body logging only
 * (credentials in flight). Body capture is gated behind the `debug` level so it costs nothing
 * at the prod default, and routed through `capBody` to bound oversized payloads.
 */
const handleRequestLogging: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname.startsWith("/_app/") || pathname === "/favicon.ico") {
		return resolve(event);
	}

	const reqId = crypto.randomUUID();
	const method = event.request.method;
	const query = event.url.search || undefined;
	const start = performance.now();
	return runWithContext(
		{ reqId, userId: event.locals.user?.id, method, path: pathname },
		async () => {
			const logBody = logger.isLevelEnabled("debug") && !pathname.startsWith("/api/auth/");

			logger.debug({ method, path: pathname, query }, "request:start");

			if (logBody) {
				const body = await readRequestBodyForLog(event.request);
				// No status yet (pre-resolve) → dev renders `->` in the status column.
				if (body !== undefined) logger.debug({ method, path: pathname, body: capBody(body) }, "request body");
			}

			const response = await resolve(event);

			if (logBody) {
				const body = await readResponseBodyForLog(response);
				if (body !== undefined)
					logger.debug({ method, path: pathname, status: response.status, body: capBody(body) }, "response body");
			}

			const fields = {
				method,
				path: pathname,
				query,
				status: response.status,
				ms: Math.round(performance.now() - start),
				userId: event.locals.user?.id,
			};
			if (response.status >= 500) logger.error(fields, "request");
			else if (response.status >= 400) logger.warn(fields, "request");
			else logger.info(fields, "request");
			return response;
		},
	);
};

/**
 * Captures unexpected server errors only — SvelteKit bypasses this for expected `error()` /
 * `fail()` / `redirect()`. Logs with a stack and a correlation id, and returns the sole
 * client-visible payload. Wrapped defensively so it can never throw.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	try {
		const errorId = getReqId() ?? crypto.randomUUID();
		logger.error({ err: error, errorId, status, path: event.url.pathname }, message);
		return { message: "Wystąpił nieoczekiwany błąd", errorId };
	} catch {
		return { message: "Wystąpił nieoczekiwany błąd" };
	}
};

export const handle = sequence(handleSecurityHeaders, handleAuth, handleRequestLogging);
