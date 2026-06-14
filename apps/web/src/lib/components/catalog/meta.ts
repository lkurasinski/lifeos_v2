/**
 * Pure presentation helpers for the catalog UI — number formatting, source-segment
 * mapping, gauge reference scaling, and the category-icon registry. No I/O, no
 * `$lib/server/*`: safe to import from client components.
 *
 * The category colours and macro gauge hues are the locked "colour encodes WHICH
 * macro / WHICH category" exception (DESIGN.md / lifeos-kit.css) — identity, not a
 * score against a target.
 */
import type { Macro } from "$lib/components/ui/gauge";
import type { FoodSource, NutrientRegistryGroup } from "$lib/food/schema";
import { MACRO_TAGS } from "$lib/macros";
import { t } from "$lib/i18n";

// ─── Number formatting (Polish: comma decimal, tabular) ───────────────────────

const NUMBER_FORMAT = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });

/** Format a nutrient amount the Polish way (comma decimal, ≤1 fraction digit). */
export function formatAmount(value: number): string {
	return NUMBER_FORMAT.format(value);
}

/** A macro figure for a card/table cell: the formatted amount, or an em-dash when absent. */
export function formatMacro(value: number | undefined): string {
	return value === undefined ? "—" : formatAmount(value);
}

// ─── Source segment (the locked 4-way toolbar: all / USDA / własne / OFF) ─────

export type SourceSegment = "all" | "usda" | "custom" | "off";

/** The two raw USDA sources collapse into one "USDA" segment in the toolbar. */
const USDA_SOURCES: FoodSource[] = ["USDA_SR", "USDA_FOUNDATION"];

/** Map a segment selection to the `sources` filter (undefined = no filter). */
export function segmentToSources(segment: SourceSegment): FoodSource[] | undefined {
	switch (segment) {
		case "usda":
			return USDA_SOURCES;
		case "custom":
			return ["CUSTOM"];
		case "off":
			return ["OFF"];
		default:
			return undefined;
	}
}

/** Derive the active toolbar segment from a `sources` filter (round-trips the above). */
export function sourcesToSegment(sources: FoodSource[] | undefined): SourceSegment {
	if (!sources || sources.length === 0) return "all";
	if (sources.includes("CUSTOM")) return "custom";
	if (sources.includes("OFF")) return "off";
	if (sources.some((s) => USDA_SOURCES.includes(s))) return "usda";
	return "all";
}

/** Short badge label for a product's source (table rows + detail chip). */
export function sourceBadgeKey(source: string): "usda" | "custom" | "off" {
	if (source === "CUSTOM") return "custom";
	if (source === "OFF") return "off";
	return "usda";
}

// ─── Macro gauge scaling ──────────────────────────────────────────────────────

/**
 * Reference maxima (per 100 g) the macro rings scale against — "how rich in this
 * macro", not a score against the user's target. Values are clamped to 0–100, so a
 * macro-dense product (an oil) simply pegs the ring; the graphite figure stays exact.
 */
export const MACRO_REFERENCE = { kcal: 900, protein: 40, carbs: 90, fat: 100 } as const;

/** Ring fill (0–100) for a macro value, or 0 when the macro is absent/null. */
export function macroPct(value: number | undefined, max: number): number {
	if (value === undefined) return 0;
	return Math.max(0, Math.min(100, (value / max) * 100));
}

/**
 * Descriptor for the four macro rings — the locked kcal/protein/carbs/fat set with
 * its INFOODS tag, Polish label, unit, and reference max. Shared by the detail view
 * (reads the value from the Meili hit) and the editable form (reads it live from the
 * matching field). A function because the labels resolve through `t()`.
 */
export type MacroGauge = { macro: Macro; label: string; tag: string; unit: string; max: number };
export function macroGauges(): MacroGauge[] {
	return [
		{
			macro: "kcal",
			label: t("catalog.macros.energy"),
			tag: MACRO_TAGS.energyKcal,
			unit: "kcal",
			max: MACRO_REFERENCE.kcal,
		},
		{
			macro: "pro",
			label: t("catalog.macros.protein"),
			tag: MACRO_TAGS.protein,
			unit: "g",
			max: MACRO_REFERENCE.protein,
		},
		{
			macro: "carb",
			label: t("catalog.macros.carbs"),
			tag: MACRO_TAGS.carbs,
			unit: "g",
			max: MACRO_REFERENCE.carbs,
		},
		{
			macro: "fat",
			label: t("catalog.macros.fat"),
			tag: MACRO_TAGS.fat,
			unit: "g",
			max: MACRO_REFERENCE.fat,
		},
	];
}

/**
 * NutrientCategory enum → Polish group heading, shared by the form and the detail view
 * (both render the registry grouped by category). A function because the labels resolve
 * through `t()` (literal keys keep `t()` typed).
 */
export function nutrientGroupLabels(): Record<string, string> {
	return {
		ENERGY: t("catalog.nutrientGroup.energy"),
		PROXIMATE: t("catalog.nutrientGroup.proximate"),
		LIPID: t("catalog.nutrientGroup.lipid"),
		MINERAL: t("catalog.nutrientGroup.mineral"),
		VITAMIN: t("catalog.nutrientGroup.vitamin"),
		AMINO_ACID: t("catalog.nutrientGroup.aminoAcid"),
		CAROTENOID: t("catalog.nutrientGroup.carotenoid"),
		OTHER: t("catalog.nutrientGroup.other"),
	};
}

export type RegistryRow = { id: string; name: string; value: number; unit: string };
export type RegistryGroup = { label: string; rows: RegistryRow[] };

/**
 * Project a nutrient registry + a `tag → value` map into display rows grouped by registry
 * category, honoring NULL≠0 (a tag absent from `values` is HIDDEN; a stored `0` renders). The
 * single home for the loop the product detail + recipe detail both render — pass `exclude` to
 * drop tags shown elsewhere (the recipe macros live in the gauges, not the full-profile list).
 * Empty groups are dropped. Pure (labels via `t()`), so it stays client-safe and testable.
 */
export function groupRegistryRows(
	registry: NutrientRegistryGroup[],
	values: Record<string, number>,
	exclude?: ReadonlySet<string>,
): RegistryGroup[] {
	const labels = nutrientGroupLabels();
	return registry
		.map((g) => ({
			label: labels[g.category] ?? g.category,
			rows: g.nutrients
				.filter((n) => values[n.id] !== undefined && !exclude?.has(n.id))
				.map((n) => ({ id: n.id, name: n.namePl || n.nameEn, value: values[n.id], unit: n.unit })),
		}))
		.filter((g) => g.rows.length > 0);
}

// ─── Category icons (identity colour; `cc` feeds the glyph's currentColor) ─────

interface CategoryGlyph {
	/** Inner SVG markup for a 0 0 20 20 viewBox (developer-authored, trusted). */
	inner: string;
	/** Identity hue (oklch) for this category. */
	cc: string;
}

// Glyph shapes carried from the locked probe (context/probes/product-catalog).
const G = {
	drop: '<path d="M10 2.4c3.2 4.3 5 6.5 5 9a5 5 0 1 1-10 0c0-2.5 1.8-4.7 5-9Z"/>',
	meat: '<path d="M12.7 3a3.7 3.7 0 0 0-5.3 5.1l-3.6 3.6a2.1 2.1 0 1 0 1.2 1.2l3.6-3.6A3.7 3.7 0 0 0 14 5l1.6-1.6a.85.85 0 0 0-1.2-1.2L12.7 3Z"/>',
	bird: '<ellipse cx="10" cy="11" rx="4.7" ry="6.4"/>',
	fish: '<path d="M2.6 10c2.4-3.2 6.3-4.9 10.3-4.9L11.7 10l1.2 4.9C8.9 14.9 5 13.2 2.6 10Z"/><path d="M13.4 5.4 17 3.4v13.2l-3.6-2 1.2-4.6-1.2-4.6Z" opacity=".5"/>',
	grain:
		'<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 17V6"/><path d="M10 7.6C8.6 6.3 6.6 6.2 6.6 6.2s.1 2 1.5 3.3M10 7.6c1.4-1.3 3.4-1.4 3.4-1.4s-.1 2-1.5 3.3"/><path d="M10 11.6C8.6 10.3 6.6 10.2 6.6 10.2s.1 2 1.5 3.3M10 11.6c1.4-1.3 3.4-1.4 3.4-1.4s-.1 2-1.5 3.3"/></g>',
	veg: '<path d="M15.6 4.4c.4 5.7-2.7 10.6-7.7 10.6-1 0-2-.2-2-.2s-.4-6.1 4.5-9.5c1.9-1.3 5.2-.9 5.2-.9Z"/>',
	fruit:
		'<path d="M10 6c-1-1.7-3.1-2.2-4.5-1.2C4 5.8 3.7 8.3 4.6 11c.8 2.4 2.4 4.5 3.9 4.5.6 0 1.1-.3 1.5-.3s.9.3 1.5.3c1.5 0 3.1-2.1 3.9-4.5.9-2.7.6-5.2-.9-6.2C13 3.8 11 4.3 10 6Z"/><path d="M10 6c.1-1.1.9-2.2 2.1-2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
	bean: '<ellipse cx="8" cy="8" rx="2.5" ry="3.7" transform="rotate(-22 8 8)"/><ellipse cx="12" cy="12.2" rx="2.5" ry="3.7" transform="rotate(-22 12 12.2)" opacity=".5"/>',
	fat: '<path d="M8.4 2.5h3.2v1.7l1.1 2.1c.2.4.3.8.3 1.2v7.5A1.5 1.5 0 0 1 11.5 16.5h-3A1.5 1.5 0 0 1 7 15v-7.5c0-.4.1-.8.3-1.2l1.1-2.1V2.5Z"/>',
	jar: '<rect x="5" y="6" width="10" height="11" rx="2.2"/><rect x="6.5" y="2.8" width="7" height="3" rx="1.2" opacity=".5"/>',
	cup: '<path d="M4.8 4h10.4l-1 11.1A2.1 2.1 0 0 1 12.1 17H7.9a2.1 2.1 0 0 1-2.1-1.9L4.8 4Z"/><path d="M5.4 8h9.2" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".5"/>',
	grid: '<rect x="3" y="3" width="6" height="6" rx="1.6"/><rect x="11" y="3" width="6" height="6" rx="1.6"/><rect x="3" y="11" width="6" height="6" rx="1.6"/><rect x="11" y="11" width="6" height="6" rx="1.6"/>',
};

const MEAT_CC = "oklch(0.58 0.140 18)";
const GRAIN_CC = "oklch(0.74 0.115 88)";

/** USDA SR Legacy category slug → its identity glyph + hue. */
const CATEGORY_GLYPHS: Record<string, CategoryGlyph> = {
	dairy: { inner: G.drop, cc: "oklch(0.66 0.085 245)" },
	spices: { inner: G.veg, cc: "oklch(0.62 0.120 135)" },
	fats: { inner: G.fat, cc: "oklch(0.78 0.120 95)" },
	poultry: { inner: G.bird, cc: "oklch(0.70 0.105 70)" },
	soups: { inner: G.jar, cc: "oklch(0.56 0.110 310)" },
	"processed-meat": { inner: G.meat, cc: MEAT_CC },
	cereals: { inner: G.grain, cc: GRAIN_CC },
	fruits: { inner: G.fruit, cc: "oklch(0.64 0.150 40)" },
	pork: { inner: G.meat, cc: MEAT_CC },
	vegetables: { inner: G.veg, cc: "oklch(0.62 0.130 150)" },
	nuts: { inner: G.bean, cc: "oklch(0.58 0.085 110)" },
	beef: { inner: G.meat, cc: MEAT_CC },
	beverages: { inner: G.cup, cc: "oklch(0.64 0.100 230)" },
	seafood: { inner: G.fish, cc: "oklch(0.64 0.100 205)" },
	legumes: { inner: G.bean, cc: "oklch(0.58 0.085 110)" },
	"lamb-game": { inner: G.meat, cc: MEAT_CC },
	baked: { inner: G.grain, cc: GRAIN_CC },
	sweets: { inner: G.fruit, cc: "oklch(0.66 0.140 350)" },
	grains: { inner: G.grain, cc: GRAIN_CC },
	snacks: { inner: G.jar, cc: "oklch(0.56 0.110 310)" },
	other: { inner: G.grid, cc: "var(--muted-foreground)" },
};

const FALLBACK_GLYPH: CategoryGlyph = { inner: G.grid, cc: "var(--muted-foreground)" };

/**
 * Display order for the facet chips, grouping kindred categories so the eye lands on
 * neighbours (all meats together, all plant foods together, …) rather than an
 * alphabetical scatter. Categories not listed here sort last, alphabetically.
 */
export const CATEGORY_ORDER: string[] = [
	// animal proteins
	"beef",
	"pork",
	"poultry",
	"lamb-game",
	"processed-meat",
	"seafood",
	// dairy & eggs
	"dairy",
	// plant foods
	"vegetables",
	"fruits",
	"legumes",
	"nuts",
	// grains & bakery
	"grains",
	"cereals",
	"baked",
	// fats, sweets, drinks
	"fats",
	"sweets",
	"beverages",
	// prepared & misc
	"soups",
	"snacks",
	"spices",
	"other",
];

/** Comparator that orders category slugs by CATEGORY_ORDER, unknowns last (a→z). */
export function compareCategories(a: string, b: string): number {
	const ia = CATEGORY_ORDER.indexOf(a);
	const ib = CATEGORY_ORDER.indexOf(b);
	if (ia !== -1 && ib !== -1) return ia - ib;
	if (ia !== -1) return -1;
	if (ib !== -1) return 1;
	return a.localeCompare(b);
}

/** The "Wszystkie" (all categories) chip glyph — neutral grid, no identity hue. */
export const ALL_CATEGORIES_GLYPH: CategoryGlyph = FALLBACK_GLYPH;

/** Resolve a category slug to its glyph + hue (neutral grid for unknown/null). */
export function categoryGlyph(slug: string | null | undefined): CategoryGlyph {
	if (!slug) return FALLBACK_GLYPH;
	return CATEGORY_GLYPHS[slug] ?? FALLBACK_GLYPH;
}
