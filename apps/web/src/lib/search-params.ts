/**
 * Shared `URLSearchParams` extractors + the common Zod field skeleton for catalog search.
 *
 * The food and recipe catalogs parse the same URL shape (`q`, `dir`, `page`, `limit`, plus
 * repeated/comma-separated facet keys) into a validated params object. These helpers are the
 * one home for that parsing so the two `parse*SearchParams` functions can't drift. Depends only
 * on `zod` — safe to import from the client-shared schema modules.
 */
import { z } from "zod";

/**
 * Read a multi-value facet param: repeated keys AND/OR comma-separated values, each trimmed and
 * de-blanked. `undefined` when empty, so the schema's `.optional()`/`.default()` applies.
 */
export function listParam(searchParams: URLSearchParams, key: string): string[] | undefined {
	const values = searchParams
		.getAll(key)
		.flatMap((v) => v.split(","))
		.map((v) => v.trim())
		.filter(Boolean);
	return values.length > 0 ? values : undefined;
}

/**
 * Read a numeric param, falling back to `undefined` (→ the schema default) when absent or
 * unparseable — so a hand-edited/shared URL stays resilient rather than 400ing on `page=abc`.
 */
export function numParam(searchParams: URLSearchParams, key: string): number | undefined {
	const raw = searchParams.get(key);
	if (raw === null || raw.trim() === "") return undefined;
	const n = Number(raw);
	return Number.isFinite(n) ? n : undefined;
}

/** The trimmed free-text `q`, or `undefined` when blank. */
export function qParam(searchParams: URLSearchParams): string | undefined {
	const q = searchParams.get("q")?.trim();
	return q ? q : undefined;
}

/**
 * Zod fields every catalog search schema shares (free text + direction + pagination). Spread
 * into a `z.object({ ...baseSearchParamsShape, <facets>, sort: <enum> })`; each catalog adds its
 * own facet fields and its own `sort` enum + default.
 */
export const baseSearchParamsShape = {
	q: z.string().trim().max(200).optional(),
	dir: z.enum(["asc", "desc"]).default("asc"),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(24),
};
