/**
 * Unit → grams resolution — the accuracy-critical conversion core.
 *
 * Pure and dependency-free (no DB, no Meili, no `$lib/server`): an (amount, unit,
 * product) triple in, canonical grams out. Returns `null` (UNRESOLVED) rather than
 * guessing — a `null` here is what makes the recipe's `nutritionComplete` flag go
 * false and the component land in `incompleteComponents`, so a missing piece-weight
 * is surfaced honestly, never silently treated as 0.
 */

/** Mirrors the Prisma `UnitKind` enum (kept local so this stays Prisma-free). */
export type UnitKind = "MASS" | "VOLUME" | "COUNT";

/** The conversion-relevant slice of a `Unit` row. */
export interface UnitConversion {
	kind: UnitKind;
	/** Multiplier to grams (MASS) or to ml (VOLUME); ignored for COUNT. */
	baseFactor: number;
}

/** The conversion-relevant slice of a `FoodProduct` row. NULL ≠ 0 throughout. */
export interface ProductConversion {
	/** g per ml; `null`/absent defaults to 1.0 (water) at resolve time. */
	densityGPerMl?: number | null;
	/** grams per piece; `null`/absent makes COUNT units unresolvable (flagged, not zeroed). */
	pieceWeightG?: number | null;
}

/**
 * Resolve an (amount, unit, product) triple to canonical grams, or `null` when it
 * cannot be resolved.
 *
 * - MASS:   `amount * baseFactor`                              (g=1, dag=10, kg=1000)
 * - VOLUME: `amount * baseFactor * (densityGPerMl ?? 1)`       (→ ml, then ml→g by density)
 * - COUNT:  `pieceWeightG != null ? amount * pieceWeightG : null`  (szt./ząbek)
 *
 * A `null` density is treated as water (1.0). A `null` piece-weight is NOT treated as
 * any default — it returns `null` so the caller can flag the component as incomplete.
 *
 * A non-finite or negative result (a `NaN`/`Infinity`/negative `amount` or `baseFactor`,
 * or a `null` piece-weight on a COUNT unit) resolves to `null` (UNRESOLVED) — bad input
 * must surface as incomplete, never as a confidently-wrong number that poisons totals,
 * the per-100g projection, or a parent recipe's weight-share term. A `0` is a legitimate
 * resolved weight and is kept.
 */
export function resolveGrams(
	amount: number,
	unit: UnitConversion,
	product: ProductConversion,
): number | null {
	let grams: number | null;
	switch (unit.kind) {
		case "MASS":
			grams = amount * unit.baseFactor;
			break;
		case "VOLUME":
			grams = amount * unit.baseFactor * (product.densityGPerMl ?? 1);
			break;
		case "COUNT":
			grams = product.pieceWeightG != null ? amount * product.pieceWeightG : null;
			break;
	}
	if (grams === null || !Number.isFinite(grams) || grams < 0) return null;
	return grams;
}
