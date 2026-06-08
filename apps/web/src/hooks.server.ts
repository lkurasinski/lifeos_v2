import { building } from "$app/environment";
import { auth } from "$lib/server/auth";
import { validateEnv } from "$lib/server/env";
import { logger } from "$lib/server/logger";
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
 * Opens a request-scoped `AsyncLocalStorage` context (so every log line in the request —
 * including Prisma and service logs — inherits a `reqId`) and emits one structured line per
 * request. Runs innermost so `event.locals.user` is already populated by `handleAuth` and the
 * timing covers the real `resolve`. Static asset noise (`/_app/*`, favicon) is skipped.
 */
const handleRequestLogging: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname.startsWith("/_app/") || pathname === "/favicon.ico") {
		return resolve(event);
	}

	const reqId = crypto.randomUUID();
	const start = performance.now();
	return runWithContext({ reqId, userId: event.locals.user?.id }, async () => {
		const response = await resolve(event);
		const fields = {
			method: event.request.method,
			path: pathname,
			status: response.status,
			ms: Math.round(performance.now() - start),
			userId: event.locals.user?.id,
		};
		if (response.status >= 500) logger.error(fields, "request");
		else if (response.status >= 400) logger.warn(fields, "request");
		else logger.info(fields, "request");
		return response;
	});
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
