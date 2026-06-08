import pino, { type Level, type LoggerOptions } from "pino";
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

// pino-pretty spawns a worker thread (thread-stream) that Vite cannot bundle, so it is
// attached only in dev. In prod the default sync NDJSON-to-stdout path runs (worker-free,
// captured natively by Railway). Excluded under vitest so tests never spawn the worker.
const usePretty = process.env.NODE_ENV !== "production" && !process.env.VITEST;

export const logger = usePretty
	? pino({
			...baseOptions,
			transport: {
				target: "pino-pretty",
				options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
			},
		})
	: pino(baseOptions);
