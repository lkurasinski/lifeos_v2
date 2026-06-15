/**
 * pl-PL decimal parse/format — the single source of truth for the comma-decimal handling that
 * the recipe amount field, the catalog product/nutrient fields, and the recipe `amountSchema`
 * preprocess all need. Pure and dependency-free (safe on client and server).
 *
 * Parsing accepts BOTH comma and dot decimals (`"1,5"` and `"1.5"` → `1.5`) so a mid-typing
 * comma still reaches live previews. It deliberately does NOT impose a sign/range guard — that
 * is a per-domain decision the caller keeps (recipe amounts reject negatives; product nutrients
 * allow a typed `0` as real data, distinct from an empty NULL field; the recipe save schema
 * layers Zod `.positive()` on top). Centralizing only the parse means those guards can differ on
 * purpose without re-implementing the comma swap three times.
 */

/**
 * Parse a raw field to a finite number, or `null`. Accepts `unknown` because one caller is a Zod
 * `preprocess` at an untrusted request boundary: a non-string/number (null, undefined, boolean,
 * object…) returns `null` rather than throwing, so the downstream `z.number()` rejects it cleanly
 * instead of 500-ing. Empty/blank → `null`; a typed `0` stays `0`; comma decimals are accepted.
 * No sign or range guard — callers add their own.
 */
export function parseDecimalPl(raw: unknown): number | null {
	if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim();
	if (trimmed === "") return null;
	const n = Number(trimmed.replace(",", "."));
	return Number.isFinite(n) ? n : null;
}

/** Format a number for a pl-PL decimal text field (dot → comma) — the inverse of the string
 *  path of {@link parseDecimalPl}, so an edited value round-trips through the input unchanged. */
export function formatDecimalPl(value: number): string {
	return String(value).replace(".", ",");
}
