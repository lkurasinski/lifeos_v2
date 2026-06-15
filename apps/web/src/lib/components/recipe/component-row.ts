/**
 * Pure helpers for the ingredient-editor rows — the per-row gram/kcal clarifier derivation
 * and the pl-PL amount parser. No I/O, no `$lib/server/*` (only the pure `resolveGrams`
 * engine and the macro tag map): safe to import from client components and unit-testable.
 */
import { resolveGrams } from "$lib/recipe/units";
import { MACRO_TAGS } from "$lib/recipe/nutrition";
import { parseDecimalPl } from "$lib/decimal";
import type { DraftComponent, UnitOption } from "$lib/recipe/schema";

/** Metric "direct" units: the amount + unit already reads precisely, so no gram clarifier. */
const DIRECT_UNIT_SLUGS: ReadonlySet<string> = new Set(["g", "dag", "kg", "ml"]);

export type RowInfo = {
	/** Resolved grams (null = unresolved, e.g. a COUNT unit with no piece weight). */
	grams: number | null;
	/** kcal contribution at the resolved weight (null when grams or nutrition data is missing). */
	kcal: number | null;
	/** True when grams or nutrition data is incomplete — the row shows a partial-data marker. */
	partial: boolean;
	/** True for metric units that already read precisely (no gram clarifier needed). */
	direct: boolean;
};

/**
 * Derive a row's gram/kcal clarifier from its picked preview. Products scale per-100g;
 * sub-recipes apportion their cached totals by weight share (grams ÷ yieldWeightG), mirroring
 * the server rollup. Returns null when the row has no usable amount/unit yet (nothing to show).
 */
export function rowInfo(c: DraftComponent, unit: UnitOption | undefined): RowInfo | null {
	if (!unit || c.amount == null || c.amount <= 0) return null;
	const direct = DIRECT_UNIT_SLUGS.has(unit.slug);
	const grams = resolveGrams(
		c.amount,
		{ kind: unit.kind, baseFactor: unit.baseFactor },
		{ densityGPerMl: c.preview.densityGPerMl, pieceWeightG: c.preview.pieceWeightG },
	);
	if (c.subRecipeId != null) {
		const yw = c.preview.yieldWeightG ?? null;
		const totals = c.preview.totals ?? {};
		const kcal =
			grams != null && yw && yw > 0 ? (grams / yw) * (totals[MACRO_TAGS.energyKcal] ?? 0) : null;
		const partial = grams == null || !yw || yw <= 0 || c.preview.nutritionComplete === false;
		return { grams, kcal, partial, direct };
	}
	const per100 = c.preview.nutrientsPer100g ?? {};
	const hasData = Object.keys(per100).length > 0;
	const kcal =
		grams != null && hasData ? (grams / 100) * (per100[MACRO_TAGS.energyKcal] ?? 0) : null;
	const partial = grams == null || !hasData;
	return { grams, kcal, partial, direct };
}

/**
 * Parse a pl-PL amount string to a NON-NEGATIVE number, or null — the recipe-domain guard on top
 * of the shared {@link parseDecimalPl} kernel (a negative ingredient amount is meaningless; a
 * typed 0 is tolerated by the preview and dropped by `recipeDraftToSavePayload`'s `> 0` filter).
 * The server re-validates via `amountSchema` (`.positive()`) regardless.
 */
export function parseAmount(raw: string): number | null {
	const n = parseDecimalPl(raw);
	return n !== null && n >= 0 ? n : null;
}
