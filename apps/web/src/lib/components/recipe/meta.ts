/**
 * Pure presentation helpers for the recipe browse + detail UI — number/time formatting,
 * per-serving macro-gauge scaling, household-unit → gram clarifiers, difficulty labels,
 * and the sort/meal-type display orders. No I/O, no `$lib/server/*`: safe to import from
 * client components.
 *
 * Recipes are REFERENCE data (per-serving values, not scored against a target — that's the
 * weekly plan's job), so the macro rings use the locked "colour encodes WHICH macro"
 * identity palette via the shared `Gauge`; the figure stays graphite.
 */
import type { Macro } from "$lib/components/ui/gauge";
import { formatAmount, macroPct } from "$lib/components/catalog/meta";
import { MACRO_TAGS } from "$lib/recipe/nutrition";
import type { RecipeDifficulty, RecipeSortKey, UnitView } from "$lib/recipe/schema";
import { t } from "$lib/i18n";

export { formatAmount, macroPct };

// ─── Per-serving macro gauges ───────────────────────────────────────────────────

/**
 * Reference maxima the per-serving macro rings scale against — "how much of this macro in a
 * serving", NOT a score against the user's target. A serving sits around these typical
 * values, so a hearty dish simply pegs the ring; the graphite figure stays exact. (Distinct
 * from the catalog's per-100g maxima — these are per *serving*.)
 */
export const RECIPE_MACRO_REFERENCE = { kcal: 800, protein: 45, carbs: 80, fat: 35 } as const;

export type RecipeMacroGauge = {
	macro: Macro;
	label: string;
	/** The cached per-serving field key on the detail view. */
	field: "energyKcalPerServing" | "proteinPerServing" | "carbsPerServing" | "fatPerServing";
	unit: string;
	max: number;
};

/** The four per-serving macro rings, in the locked kcal/protein/carbs/fat order. */
export function recipeMacroGauges(): RecipeMacroGauge[] {
	return [
		{ macro: "kcal", label: t("recipe.macros.energy"), field: "energyKcalPerServing", unit: "kcal", max: RECIPE_MACRO_REFERENCE.kcal },
		{ macro: "pro", label: t("recipe.macros.protein"), field: "proteinPerServing", unit: "g", max: RECIPE_MACRO_REFERENCE.protein },
		{ macro: "carb", label: t("recipe.macros.carbs"), field: "carbsPerServing", unit: "g", max: RECIPE_MACRO_REFERENCE.carbs },
		{ macro: "fat", label: t("recipe.macros.fat"), field: "fatPerServing", unit: "g", max: RECIPE_MACRO_REFERENCE.fat },
	];
}

/** Card macro dots (protein / carbs / fat) — the compact per-serving figures under the kcal. */
export type CardMacro = { macro: Macro; field: "proteinPerServing" | "carbsPerServing" | "fatPerServing" };
export const CARD_MACROS: CardMacro[] = [
	{ macro: "pro", field: "proteinPerServing" },
	{ macro: "carb", field: "carbsPerServing" },
	{ macro: "fat", field: "fatPerServing" },
];

/** The four macro INFOODS tagnames, so the full-profile expander can skip them (already shown). */
export const MACRO_TAG_SET: ReadonlySet<string> = new Set(Object.values(MACRO_TAGS));

// ─── Time formatting (minutes → "1 godz 40 min") ─────────────────────────────────

/**
 * Format a total time in minutes the Polish way: `90 → "1 godz 30 min"`, `45 → "45 min"`,
 * `120 → "2 godz"`. `null`/0 → `null` (nothing to show).
 */
export function formatMinutes(min: number | null | undefined): string | null {
	if (min == null || min <= 0) return null;
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (h === 0) return `${m} min`;
	if (m === 0) return `${h} godz`;
	return `${h} godz ${m} min`;
}

/** Total recipe time = prep + cook (null only when both are absent). */
export function totalTime(prepTimeMin: number | null, cookTimeMin: number | null): number | null {
	if (prepTimeMin == null && cookTimeMin == null) return null;
	return (prepTimeMin ?? 0) + (cookTimeMin ?? 0);
}

// ─── Difficulty ──────────────────────────────────────────────────────────────────

/** Localized difficulty label (`null` → empty). */
export function difficultyLabel(difficulty: RecipeDifficulty | null): string {
	switch (difficulty) {
		case "EASY":
			return t("recipe.difficulty.easy");
		case "MEDIUM":
			return t("recipe.difficulty.medium");
		case "HARD":
			return t("recipe.difficulty.hard");
		default:
			return "";
	}
}

/**
 * The difficulty facet options. A lazy function (like `sortOptions`/`recipeMacroGauges`) — NOT
 * a module-load constant — so the labels resolve at call time and follow a locale switch.
 */
export function difficultyOptions(): { value: RecipeDifficulty; label: string }[] {
	return [
		{ value: "EASY", label: t("recipe.difficulty.easy") },
		{ value: "MEDIUM", label: t("recipe.difficulty.medium") },
		{ value: "HARD", label: t("recipe.difficulty.hard") },
	];
}

// ─── Household-unit → gram clarifier ──────────────────────────────────────────────

/** Metric "direct" units: the amount + unit already reads as a precise measure, no clarifier. */
const DIRECT_UNIT_SLUGS: ReadonlySet<string> = new Set(["g", "dag", "kg", "ml"]);

export type ComponentQty = {
	/** The primary amount + unit, e.g. `"1 łyżka"` / `"250 ml"`. */
	main: string;
	/** Gram clarifier (`"15 g"` / `"≈120 g"`), or `null` when the unit is already metric. */
	clarifier: string | null;
	/** A household unit whose grams couldn't be resolved (e.g. a COUNT unit with no piece-weight). */
	missing: boolean;
};

/**
 * Render a component amount the way the detail probes do: the metric units (`g`/`dag`/`kg`/`ml`)
 * show just the amount + unit, while household measures (`łyżka`/`szklanka`/`szt.`/`ząbek`)
 * append a gram clarifier — exact for VOLUME (`1 łyżka · 15 g`), approximate for COUNT
 * (`1 szt. · ≈120 g`). An unresolved household unit flips `missing` so the UI can mark it.
 */
export function formatComponentQty(amount: number, unit: UnitView, gramsResolved: number | null): ComponentQty {
	const main = `${formatAmount(amount)} ${unit.namePl}`;
	if (DIRECT_UNIT_SLUGS.has(unit.slug)) {
		return { main, clarifier: null, missing: false };
	}
	if (gramsResolved == null) {
		return { main, clarifier: t("recipe.detail.noData"), missing: true };
	}
	const prefix = unit.kind === "COUNT" ? "≈" : "";
	return { main, clarifier: `${prefix}${formatAmount(gramsResolved)} g`, missing: false };
}

// ─── Sort + facet ordering ────────────────────────────────────────────────────────

export function sortOptions(): { key: RecipeSortKey; label: string }[] {
	return [
		{ key: "relevance", label: t("recipe.sort.relevance") },
		{ key: "kcal", label: t("recipe.sort.kcal") },
		{ key: "protein", label: t("recipe.sort.protein") },
		{ key: "time", label: t("recipe.sort.time") },
		{ key: "name", label: t("recipe.sort.name") },
	];
}

/** Default sort direction per key (name/time ascend; macros descend so the richest surface first). */
export function defaultSortDir(key: RecipeSortKey): "asc" | "desc" {
	return key === "name" || key === "time" || key === "relevance" ? "asc" : "desc";
}

/** Meal-type chip display order (the seeded closed set), unknown slugs last. */
const MEAL_TYPE_ORDER = ["breakfast", "lunch", "dinner", "snack", "dessert", "sauce", "base", "side"];

/** Order meal-type taxonomy rows by the closed-set display order, unknowns last (by namePl). */
export function compareMealTypes(a: string, b: string): number {
	const ia = MEAL_TYPE_ORDER.indexOf(a);
	const ib = MEAL_TYPE_ORDER.indexOf(b);
	if (ia !== -1 && ib !== -1) return ia - ib;
	if (ia !== -1) return -1;
	if (ib !== -1) return 1;
	return a.localeCompare(b, "pl");
}
