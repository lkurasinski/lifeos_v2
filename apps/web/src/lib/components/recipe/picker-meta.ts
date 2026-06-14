/**
 * Pure meta-line formatters for the ingredient picker's result rows — the "USDA · 120 kcal /
 * 100 g · Brand" (product) and "120 kcal / porcję · 4 porcje" (sub-recipe) sub-labels. No I/O,
 * no `$lib/server/*` (only the synchronous i18n `t()` and the shared `formatAmount`): safe to
 * import from client components and unit-testable.
 */
import type { FoodDocument } from "$lib/food/schema";
import type { RecipeDocument } from "$lib/recipe/schema";
import { t } from "$lib/i18n";
import { formatAmount } from "./meta";

/** Collapse a raw product source to its short badge ("USDA" / "OFF" / localized custom). */
function sourceLabel(source: string): string {
	switch (source) {
		case "USDA_SR":
		case "USDA_FOUNDATION":
			return "USDA";
		case "OFF":
			return "OFF";
		case "CUSTOM":
			return t("catalog.sourceBadge.custom");
		default:
			return source;
	}
}

/** Product result sub-label: source · per-100g kcal (when known) · brand (when present). */
export function productMeta(hit: FoodDocument): string {
	const parts = [sourceLabel(hit.source)];
	if (hit.energyKcal !== undefined) parts.push(`${formatAmount(hit.energyKcal)} kcal / 100 g`);
	if (hit.brand) parts.push(hit.brand);
	return parts.join(" · ");
}

/** Sub-recipe result sub-label: per-serving kcal (when known) · serving count. */
export function recipeMeta(hit: RecipeDocument): string {
	const parts: string[] = [];
	if (hit.energyKcalPerServing !== undefined)
		parts.push(`${formatAmount(hit.energyKcalPerServing)} ${t("recipe.form.kcalPerServing")}`);
	parts.push(`${hit.servings} ${t("recipe.detail.servings")}`);
	return parts.join(" · ");
}
