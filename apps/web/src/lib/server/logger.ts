import pino, { type Level, type LoggerOptions } from "pino";
import { fileURLToPath } from "node:url";
import { getReqId } from "./request-context.js";

/**
 * Resolve the active log level from the environment. Pure for testability.
 * `LOG_LEVEL` wins; otherwise prod defaults to `info`, everything else to `debug`.
 */
export function resolveLevel(env: { LOG_LEVEL?: string; NODE_ENV?: string }): Level {
	return (env.LOG_LEVEL as Level) ?? (env.NODE_ENV === "production" ? "info" : "debug");
}

/**
 * Secret-bearing paths masked to `[Redacted]` on every log line. Covers top-level
 * and one-level-nested fields plus the request/response header carriers.
 */
export const REDACT_PATHS = [
	"password",
	"*.password",
	"token",
	"*.token",
	"secret",
	"*.secret",
	"authorization",
	"req.headers.authorization",
	"req.headers.cookie",
	'res.headers["set-cookie"]',
];

/** Stamps the current request's `reqId` onto every log line; emits nothing outside a request scope. */
export function reqIdMixin(): Record<string, string> {
	const id = getReqId();
	return id ? { reqId: id } : {};
}

/** Transport-free base options — shared by the singleton and by unit tests. */
export const baseOptions: LoggerOptions = {
	level: resolveLevel(process.env),
	serializers: { err: pino.stdSerializers.err },
	redact: REDACT_PATHS,
	mixin: reqIdMixin,
};

/**
 * Prod NDJSON shape aligned to Railway's structured-log parser: string `level` (so
 * `@level:error` filtering matches), `message` as the content key, ISO timestamps, and no
 * `pid`/`hostname` noise (single-process container; Railway already tags service/replica).
 */
export const prodOptions: LoggerOptions = {
	...baseOptions,
	messageKey: "message",
	timestamp: pino.stdTimeFunctions.isoTime,
	base: undefined,
	formatters: { level: (label) => ({ level: label }) },
};

// A prettifier transport spawns a worker thread (thread-stream) that Vite cannot bundle, so
// it is attached only in dev. In prod the default sync NDJSON-to-stdout path runs (worker-free,
// captured natively by Railway). Excluded under vitest so tests never spawn the worker.
const usePretty = process.env.NODE_ENV !== "production" && !process.env.VITEST;

// Local pino-princess wrapper that swaps the level emoji for a geometric glyph (see
// pretty-transport.mjs). Resolved
// from this module's own path (sibling .mjs) rather than `new URL(literal, import.meta.url)` —
// the latter is statically rewritten by Vite into an asset reference. The worker loads it by
// absolute path. Computed lazily inside the dev branch so prod never touches it.
const prettyTransportTarget = () => fileURLToPath(import.meta.url).replace(/logger\.[^/]+$/, "pretty-transport.mjs");

export const logger = usePretty
	? pino({
			...baseOptions,
			transport: {
				target: prettyTransportTarget(),
				// Render the HTTP one-liner (method / status / path / id / duration) from our
				// flat field names via keyMap, so dev gets the single-line format without
				// changing the prod NDJSON shape. `singleLine` keeps any extra fields inline.
				// `colors: true` forces pino-princess's color scheme on: as a pino transport it
				// runs in a worker thread whose stdout isn't detected as a TTY, so chalk's
				// auto-detection otherwise disables color and the lines print monochrome.
				options: {
					singleLine: true,
					colors: true,
					keyMap: {
						"req.method": "method",
						"res.statusCode": "status",
						"req.url": "path",
						"req.id": "reqId",
						responseTime: "ms",
					},
				},
			},
		})
	: pino(prodOptions);
