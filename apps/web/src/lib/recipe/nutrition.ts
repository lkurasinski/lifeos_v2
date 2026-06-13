/**
 * Recipe nutrition rollup — the accuracy-critical aggregation core.
 *
 * Pure and dependency-free (no DB, no Meili, no Prisma models): a generic component
 * list + resolver callbacks in, cached-nutrition shape out. Decoupled from the
 * `Recipe` row on purpose so a later meal-plan entry (S-06) can reuse it to roll up
 * an instance with per-component amount overrides — do NOT let it grow a dependency
 * on Prisma models.
 *
 * Everything is keyed by `infoodsTagname` (the single canonical recipe-nutrition key):
 * the same key the food-search hit already carries, the cached `nutrients` map, and
 * the recipe Meili doc. The four macros ARE tagnames (see `MACRO_TAGS`), so macro
 * promotion is a plain key read with no id resolution.
 *
 * Honesty contract: a component whose grams can't be resolved, whose product is
 * unmapped / has no nutrient data, or whose sub-recipe is itself incomplete
 * contributes what it can (its weight still counts toward `yieldWeightG` when grams
 * resolve) but is recorded in `incompleteComponents` and flips `nutritionComplete`
 * false — never silently zeroed.
 */
import { resolveGrams, type UnitConversion, type ProductConversion } from "./units.js";

/** The four macros, by their INFOODS tagnames — promoted to dedicated cached columns. */
export const MACRO_TAGS = {
	energyKcal: "ENERC_KCAL",
	protein: "PROCNT",
	fat: "FAT",
	carbs: "CHOCDF",
} as const;

/** One recipe line — a product OR a sub-recipe — in engine-generic form. */
export interface RollupComponent {
	kind: "product" | "subRecipe";
	/** The productId or subRecipeId — also the key the resolver callback is keyed by. */
	refId: string;
	/** Display name, surfaced in `incompleteComponents` so the UI can name the offender. */
	name: string;
	amount: number;
	unit: UnitConversion;
}

/** What `resolveProductNutrients` returns for a mapped product (`null` ⇒ unmapped). */
export interface ProductNutrition extends ProductConversion {
	/** Per-100g amounts keyed by INFOODS tagname; NULL-amount nutrients already excluded. */
	nutrientsPer100g: Record<string, number>;
}

/** What `resolveSubRecipe` returns for a sub-recipe (`null` ⇒ missing). Reads the
 *  sub-recipe's CACHED `(totals, yieldWeightG)` — no live recursion here. */
export interface SubRecipeNutrition {
	/** Cached recipe totals keyed by INFOODS tagname. */
	totals: Record<string, number>;
	/** Cached derived yield weight; `null`/0 when the sub-recipe couldn't be resolved. */
	yieldWeightG: number | null;
	/** Whether the cached sub-recipe nutrition is itself complete (propagates upward). */
	nutritionComplete: boolean;
}

/** A component that could not contribute a full nutrition profile — names the offender. */
export interface IncompleteComponent {
	kind: "product" | "subRecipe";
	refId: string;
	name: string;
}

export interface RollupResult {
	/** Whole-recipe nutrient totals, keyed by INFOODS tagname. */
	totals: Record<string, number>;
	/** Per-serving projection (`totals / servings`), keyed by INFOODS tagname. */
	perServing: Record<string, number>;
	nutritionComplete: boolean;
	incompleteComponents: IncompleteComponent[];
	/** Derived dish weight = Σ(component gramsResolved). The authoritative pair with `totals`. */
	yieldWeightG: number;
}

export type ResolveProductNutrients = (productId: string) => ProductNutrition | null;
export type ResolveSubRecipe = (subRecipeId: string) => SubRecipeNutrition | null;

/**
 * Roll up component nutrition into the cached `(totals, yieldWeightG)` pair plus the
 * per-serving projection and completeness provenance.
 *
 * - Products: `totals[tag] += (gramsResolved / 100) * per100g[tag]`.
 * - Sub-recipes: contribution = `(gramsResolved / subRecipe.yieldWeightG) * subRecipe.totals`,
 *   using the sub-recipe's CACHED derived `yieldWeightG` as the weight-share denominator.
 * - `yieldWeightG = Σ gramsResolved` (derived here; per-100g = `totals * 100 / yieldWeightG`).
 *
 * `servings <= 0` is treated as 1 for the per-serving projection.
 */
export function rollupRecipe(
	components: RollupComponent[],
	servings: number,
	resolveProductNutrients: ResolveProductNutrients,
	resolveSubRecipe: ResolveSubRecipe,
): RollupResult {
	const totals: Record<string, number> = {};
	const incompleteComponents: IncompleteComponent[] = [];
	const incompleteSeen = new Set<string>();
	let yieldWeightG = 0;
	let nutritionComplete = true;

	// Flip the recipe incomplete and name the offending component — deduped by
	// (kind, refId) so the same product listed twice (e.g. flour in dough + for
	// dusting) names it once in the honest partial-data banner.
	const markIncomplete = (c: RollupComponent) => {
		nutritionComplete = false;
		const key = `${c.kind}:${c.refId}`;
		if (incompleteSeen.has(key)) return;
		incompleteSeen.add(key);
		incompleteComponents.push({ kind: c.kind, refId: c.refId, name: c.name });
	};

	for (const component of components) {
		if (component.kind === "product") {
			const product = resolveProductNutrients(component.refId);
			// Unmapped product: no conversion data, no nutrients — contributes nothing.
			if (product === null) {
				markIncomplete(component);
				continue;
			}
			const grams = resolveGrams(component.amount, component.unit, product);
			// COUNT unit on a product without pieceWeightG (etc.) — unresolvable.
			if (grams === null) {
				markIncomplete(component);
				continue;
			}
			yieldWeightG += grams;
			const tags = Object.keys(product.nutrientsPer100g);
			// Mapped but no nutrient data (e.g. a spice with an empty profile) — weight
			// counts toward yield, but it's flagged so the partial banner can name it.
			if (tags.length === 0) {
				markIncomplete(component);
				continue;
			}
			const factor = grams / 100;
			for (const tag of tags) {
				totals[tag] = (totals[tag] ?? 0) + product.nutrientsPer100g[tag] * factor;
			}
		} else {
			const subRecipe = resolveSubRecipe(component.refId);
			if (subRecipe === null) {
				markIncomplete(component);
				continue;
			}
			// Sub-recipes carry no density/piece-weight of their own.
			const grams = resolveGrams(component.amount, component.unit, {});
			if (grams === null) {
				markIncomplete(component);
				continue;
			}
			yieldWeightG += grams;
			// No usable weight-share denominator → can't apportion the sub-recipe's totals.
			// A NaN/Infinity cached yield must be rejected too (it would slip past `<= 0`
			// and produce a NaN share that poisons this recipe and every parent above it).
			if (
				subRecipe.yieldWeightG === null ||
				!Number.isFinite(subRecipe.yieldWeightG) ||
				subRecipe.yieldWeightG <= 0
			) {
				markIncomplete(component);
				continue;
			}
			const share = grams / subRecipe.yieldWeightG;
			for (const tag of Object.keys(subRecipe.totals)) {
				totals[tag] = (totals[tag] ?? 0) + subRecipe.totals[tag] * share;
			}
			// Propagate the sub-recipe's own incompleteness upward, naming the sub-recipe.
			if (!subRecipe.nutritionComplete) {
				markIncomplete(component);
			}
		}
	}

	const divisor = servings > 0 ? servings : 1;
	const perServing: Record<string, number> = {};
	for (const tag of Object.keys(totals)) {
		perServing[tag] = totals[tag] / divisor;
	}

	return { totals, perServing, nutritionComplete, incompleteComponents, yieldWeightG };
}
