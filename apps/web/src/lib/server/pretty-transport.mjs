// Dev-only pino transport: pino-princess with two formatter overrides —
//   1. the level emoji replaced by a colored geometric glyph (◆ DEBUG, ▲ WARN, …);
//   2. the URL/path column gains a dim `->` placeholder when the line has no HTTP status,
//      so method → URL stays aligned whether or not a status is present.
//
// pino-princess hardcodes these formatters and they're functions, which can't be passed through
// pino's `transport.options` (serialized to the worker thread). This module runs INSIDE that
// worker, so it can define the overrides locally and hand them to pino-princess's `build`.
//
// Loaded by the worker as a plain ESM module (NOT through Vite), so it stays dependency-light:
// it colors with raw ANSI codes rather than importing `chalk` (not a direct dep under pnpm). It
// is referenced only as a transport `target` path, never imported, so it never enters the
// production bundle (prod uses the transport-free NDJSON path).
import build from "pino-princess";

/** pino numeric levels → names. */
const NAME = { 10: "TRACE", 20: "DEBUG", 30: "INFO", 40: "WARN", 50: "ERROR", 60: "FATAL" };
/** Level → ANSI foreground code (trace gray, debug blue, info cyan, warn yellow, error/fatal red). */
const COLOR = { TRACE: 90, DEBUG: 34, INFO: 36, WARN: 33, ERROR: 31, FATAL: 31 };
/** Level → geometric glyph replacing pino-princess's emoji. */
const GLYPH = { TRACE: "·", DEBUG: "◆", INFO: "ℹ", WARN: "▲", ERROR: "✖", FATAL: "■" };

/** Replacement for pino-princess's `formatLevel`: glyph + colored level word, both in the level's
 *  color, with the same 5-char-region padding so the rest of the line stays aligned. */
function formatLevel(value) {
	const name = typeof value === "number" ? NAME[value] : String(value ?? "").toUpperCase();
	if (!name || !COLOR[name]) return "";
	const c = COLOR[name];
	return `\x1b[${c}m${GLYPH[name]}\x1b[39m \x1b[${c}m${name}\x1b[39m` + " ".repeat(Math.max(0, 5 - name.length));
}

/** Replacement for pino-princess's `formatUrl` (registered on our `path` field via keyMap).
 *  Renders the URL magenta. When the line carries no HTTP status, the status column is empty, so
 *  emit a dim `->` (4-char-wide region) in its place — keeps method → URL aligned with
 *  status-bearing lines (`GET  ->  /foods` vs `GET  200 /foods`). `status` is our keyMap name for
 *  `res.statusCode`. */
function formatUrl(url, logObj = {}) {
	const hasStatus = logObj != null && logObj.status != null && logObj.status !== "";
	const magenta = `\x1b[35m${url}\x1b[39m`;
	return hasStatus ? magenta : `\x1b[90m->\x1b[39m  ${magenta}`;
}

export default function (options) {
	return build({ ...options, format: { level: formatLevel, path: formatUrl } });
}
