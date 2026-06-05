/**
 * Shared food-catalog contracts — the client↔server boundary.
 *
 * Depends ONLY on `zod`. Imports nothing from `$lib/server/*` or `$env/*`, so it is
 * safe to import from client components (via `$lib/food/schema`), from server
 * endpoints, and — type-only — from the dependency-free `food-document.ts` used by
 * the tsx batch index chain.
 *
 * NULL ≠ 0: a nutrient `amountPer100g` of `null` means "no data" and is distinct
 * from a stored `0`. The schemas below accept `number | null` and the pure adapters
 * preserve the distinction end-to-end.
 */
import { z } from "zod";

// ─── Source enum (mirrors the Prisma `FoodSource`) ───────────────────────────

export const FOOD_SOURCES = ["USDA_SR", "USDA_FOUNDATION", "OFF", "CUSTOM"] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

/** Sources a user may create through the catalog (manual entry or OFF confirm). */
export const ADDABLE_SOURCES = ["CUSTOM", "OFF"] as const;

// ─── Read model: the Meilisearch document ────────────────────────────────────

/**
 * The denormalized catalog read model — the only shape the browse/detail UI reads.
 * The four macros are promoted to top-level numerics so Meili can sort on them
 * (it cannot sort nested fields). A macro that is absent/null is OMITTED, never 0.
 * `nutrients` carries only present (non-null) values, keyed by INFOODS tagname.
 */
export interface FoodDocument {
	id: string;
	namePl: string | null;
	nameEn: string;
	brand: string | null;
	source: string;
	sourceId: string;
	userModified: boolean;
	categorySlug: string | null;
	categoryNamePl: string | null;
	servingSizeG: number | null;
	energyKcal?: number;
	protein?: number;
	fat?: number;
	carbs?: number;
	nutrients: Record<string, number>;
	// OFF product photos (CC-BY-SA). Absent when the product has none (omitted, never "").
	imageUrl?: string;
	imageThumbUrl?: string;
	imageIngredientsUrl?: string;
	imageNutritionUrl?: string;
}

// ─── Canonical editable draft (manual / OFF / edit all produce this) ──────────

/** One nutrient value on a draft. `amountPer100g === null` means "no data" (≠ 0). */
export interface DraftNutrientValue {
	nutrientId: string;
	amountPer100g: number | null;
}

/**
 * The single canonical editable model for a not-yet-persisted (or being-edited)
 * Food. Its `nutrients` array IS the save-payload shape. There is no separate OFF
 * draft type — manual entry, OFF preview, and edit prefill all yield a DraftProduct.
 */
export interface DraftProduct {
	source: FoodSource;
	sourceId?: string;
	nameEn: string;
	namePl?: string | null;
	brand?: string | null;
	categoryId?: string | null;
	servingSizeG?: number | null;
	// OFF product photos (CC-BY-SA), carried through preview → save and edit prefill.
	imageUrl?: string | null;
	imageThumbUrl?: string | null;
	imageIngredientsUrl?: string | null;
	imageNutritionUrl?: string | null;
	nutrients: DraftNutrientValue[];
}

/** OFF-preview envelope: the canonical draft plus a dedup flag. No conversion data. */
export interface PreviewResult {
	draft: DraftProduct;
	existing?: { id: string };
}

// ─── Nutrient registry (read-only metadata for grouping/display) ──────────────

export interface NutrientRegistryEntry {
	id: string;
	infoodsTagname: string;
	nameEn: string;
	namePl: string;
	unit: string;
	category: string;
	displayRank: number | null;
}

export interface NutrientRegistryGroup {
	category: string;
	nutrients: NutrientRegistryEntry[];
}

/** One catalog category — id + slug + names, for the browse facet chips (slug) and
 *  the product-form category select (id). */
export interface FoodCategoryMeta {
	id: string;
	slug: string;
	namePl: string;
	nameEn: string;
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

/** A nutrient amount accepts `number | null` and keeps "absent" distinct from `0`. */
const nutrientAmountSchema = z.object({
	nutrientId: z.uuid(),
	amountPer100g: z.number().min(0).nullable(),
});

export const SORT_KEYS = ["name", "kcal", "protein", "fat", "carbs"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** Normalized catalog search params (the endpoint pre-parses the URL into this). */
export const searchParamsSchema = z.object({
	q: z.string().trim().max(200).optional(),
	sources: z.array(z.enum(FOOD_SOURCES)).optional(),
	categories: z.array(z.string()).optional(),
	sort: z.enum(SORT_KEYS).default("name"),
	dir: z.enum(["asc", "desc"]).default("asc"),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(24),
});
export type SearchParams = z.infer<typeof searchParamsSchema>;

/**
 * The catalog search result — what `searchFoodProducts` returns and the browse UI
 * (page load + `GET /api/foods`) consumes. Each facet map carries the switchable
 * counts from its OWN (disjunctive) query, so an active filter never collapses its
 * own facet to a single value.
 */
export interface FoodSearchResult {
	hits: FoodDocument[];
	total: number;
	page: number;
	limit: number;
	facets: {
		source: Record<string, number>;
		categorySlug: Record<string, number>;
	};
}

/**
 * Parse a `URLSearchParams` into validated `SearchParams` (shared by the SSR page
 * load and the thin GET endpoint so both honor the same contract). `sources` and
 * `categories` accept repeated keys and/or comma-separated values; blank `q` and
 * unparseable `page`/`limit` fall back to the schema defaults rather than 400ing, so
 * hand-edited/shared URLs stay resilient. An invalid `sort`/`dir`/`source` enum still
 * throws (a real client error the endpoint surfaces as 400).
 */
export function parseSearchParams(searchParams: URLSearchParams): SearchParams {
	const list = (key: string): string[] | undefined => {
		const values = searchParams
			.getAll(key)
			.flatMap((v) => v.split(","))
			.map((v) => v.trim())
			.filter(Boolean);
		return values.length > 0 ? values : undefined;
	};
	const num = (key: string): number | undefined => {
		const raw = searchParams.get(key);
		if (raw === null || raw.trim() === "") return undefined;
		const n = Number(raw);
		return Number.isFinite(n) ? n : undefined;
	};
	const q = searchParams.get("q")?.trim();

	return searchParamsSchema.parse({
		q: q ? q : undefined,
		sources: list("sources"),
		categories: list("categories"),
		sort: searchParams.get("sort") ?? undefined,
		dir: searchParams.get("dir") ?? undefined,
		page: num("page"),
		limit: num("limit"),
	});
}

/** Create payload (manual CUSTOM or confirmed OFF). */
export const savePayloadSchema = z.object({
	source: z.enum(ADDABLE_SOURCES),
	sourceId: z.string().optional(),
	nameEn: z.string().trim().min(1).max(300),
	namePl: z.string().trim().max(300).nullable().optional(),
	brand: z.string().trim().max(200).nullable().optional(),
	categoryId: z.uuid().nullable().optional(),
	servingSizeG: z.number().min(0).nullable().optional(),
	// OFF photo URLs (CC-BY-SA). Bounded length; absent/blank → null. Not user-entered.
	imageUrl: z.string().trim().max(2048).nullable().optional(),
	imageThumbUrl: z.string().trim().max(2048).nullable().optional(),
	imageIngredientsUrl: z.string().trim().max(2048).nullable().optional(),
	imageNutritionUrl: z.string().trim().max(2048).nullable().optional(),
	nutrients: z.array(nutrientAmountSchema),
});
export type SavePayload = z.infer<typeof savePayloadSchema>;

/** Edit payload — the save payload minus the immutable identity fields. */
export const patchPayloadSchema = savePayloadSchema.omit({ source: true, sourceId: true });
export type PatchPayload = z.infer<typeof patchPayloadSchema>;

// ─── Pure adapters (no I/O) ───────────────────────────────────────────────────

/**
 * Smart-input detection for the OFF add flow: a query that is 8–14 digits (after
 * stripping whitespace) is an EAN barcode → single-product lookup; anything else is
 * a free-text search. Pure so the endpoint and the UI agree and it stays unit-testable.
 */
export function isBarcodeQuery(query: string): boolean {
	const cleaned = query.replace(/\s+/g, "");
	return /^\d{8,14}$/.test(cleaned);
}

/** Blank editable draft for manual entry. */
export function emptyDraft(source: FoodSource): DraftProduct {
	return {
		source,
		nameEn: "",
		namePl: null,
		brand: null,
		categoryId: null,
		servingSizeG: null,
		imageUrl: null,
		imageThumbUrl: null,
		imageIngredientsUrl: null,
		imageNutritionUrl: null,
		nutrients: [],
	};
}

/**
 * Keyword → catalog-slug table for best-effort OFF category matching. OFF's taxonomy is
 * large and free-form, so we match whole tokens against these fixed slugs. Order is
 * priority: when one OFF tag's tokens hit several rows, the earlier row wins (e.g. a
 * "chicken broth" tag resolves to poultry before soups). Tokens are matched as whole
 * words, so "nut" never fires inside "butternut".
 */
const CATEGORY_KEYWORDS: Array<{ slug: string; tokens: string[] }> = [
	{ slug: "processed-meat", tokens: ["sausage", "sausages", "luncheon", "charcuterie", "ham", "hams", "salami", "bacon", "deli", "prosciutto", "kielbasa"] },
	{ slug: "lamb-game", tokens: ["lamb", "veal", "game", "mutton", "venison"] },
	{ slug: "beef", tokens: ["beef"] },
	{ slug: "pork", tokens: ["pork"] },
	{ slug: "poultry", tokens: ["poultry", "chicken", "turkey", "duck"] },
	{ slug: "seafood", tokens: ["fish", "seafood", "finfish", "shellfish", "tuna", "salmon", "shrimp", "cod", "mackerel", "herring", "sardine", "sardines"] },
	{ slug: "dairy", tokens: ["dairy", "dairies", "milk", "milks", "cheese", "cheeses", "yogurt", "yogurts", "yoghurt", "yoghurts", "cream", "creams", "butter", "egg", "eggs", "kefir"] },
	{ slug: "fruits", tokens: ["fruit", "fruits", "juice", "juices", "nectar", "nectars"] },
	{ slug: "vegetables", tokens: ["vegetable", "vegetables"] },
	{ slug: "legumes", tokens: ["legume", "legumes", "lentil", "lentils", "bean", "beans", "chickpea", "chickpeas", "tofu"] },
	{ slug: "nuts", tokens: ["nut", "nuts", "seed", "seeds", "almond", "almonds", "peanut", "peanuts", "cashew", "cashews", "walnut", "walnuts", "pistachio"] },
	{ slug: "cereals", tokens: ["cereal", "cereals", "muesli", "granola", "cornflakes"] },
	{ slug: "grains", tokens: ["pasta", "pastas", "noodle", "noodles", "rice", "grain", "grains", "flour", "wheat", "oat", "oats", "quinoa"] },
	{ slug: "baked", tokens: ["bread", "breads", "bakery", "pastry", "pastries", "cake", "cakes", "bun", "buns", "croissant", "baked"] },
	{ slug: "sweets", tokens: ["chocolate", "chocolates", "candy", "candies", "sweet", "sweets", "dessert", "desserts", "confectionery", "biscuit", "biscuits", "cookie", "cookies", "jam", "honey"] },
	{ slug: "snacks", tokens: ["snack", "snacks", "crisp", "crisps", "chips", "cracker", "crackers", "popcorn"] },
	{ slug: "spices", tokens: ["spice", "spices", "herb", "herbs", "condiment", "condiments", "seasoning", "seasonings"] },
	{ slug: "fats", tokens: ["oil", "oils", "fat", "fats", "margarine", "lard"] },
	{ slug: "soups", tokens: ["soup", "soups", "sauce", "sauces", "gravy", "gravies", "broth", "broths", "dip", "dips"] },
	{ slug: "beverages", tokens: ["water", "waters", "soda", "sodas", "drink", "drinks", "beverage", "beverages", "tea", "teas", "coffee", "coffees", "lemonade", "cola", "smoothie"] },
];

/**
 * Best-effort map from an OFF product's `categories_tags` hierarchy to one of our fixed
 * FoodCategory slugs. OFF orders tags general→specific, so we scan from the most specific
 * tag backwards (a specific tag is a better signal than its broad parent) and match whole
 * tokens against `CATEGORY_KEYWORDS`. Returns null when nothing matches — the user then
 * picks a category in the form. Deliberately NOT exhaustive; it only needs to pre-fill the
 * obvious cases and leave the rest to the human.
 */
export function matchFoodCategorySlug(categoriesTags: string[] | undefined): string | null {
	if (!categoriesTags?.length) return null;
	for (let i = categoriesTags.length - 1; i >= 0; i--) {
		const raw = categoriesTags[i];
		// Strip the language prefix ("en:orange-juices" → "orange-juices") then tokenize.
		const label = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1) : raw;
		const tokens = new Set(label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
		for (const { slug, tokens: keys } of CATEGORY_KEYWORDS) {
			if (keys.some((k) => tokens.has(k))) return slug;
		}
	}
	return null;
}

/**
 * Assemble a canonical OFF draft from the OFF product metadata and the
 * already-mapped, factor-applied nutrient rows (produced by `buildNutrimentRows`
 * in `$lib/server/off`, where the registry conversion factors live). The output
 * carries canonical-unit amounts only — no raw→converted annotation reaches the form.
 * No nutriments → an empty `nutrients` array → every field renders as "brak danych".
 * `categorySlugToId` (slug → FoodCategory id) lets the OFF `categories_tags` pre-fill the
 * category select via `matchFoodCategorySlug`; absent map or no match → null (user picks).
 */
export function offToDraft(
	off: {
		code: string;
		product_name?: string;
		product_name_pl?: string | null;
		brands?: string;
		categories_tags?: string[];
		image_url?: string;
		image_thumb_url?: string;
		image_ingredients_url?: string;
		image_nutrition_url?: string;
	},
	nutrientRows: Array<{ nutrientId: string; amountPer100g: number }>,
	categorySlugToId?: Map<string, string>,
): DraftProduct {
	// OFF `brands` is a comma-separated list — keep the first (primary) brand; the user
	// can correct it in the editable preview before saving.
	const brand = off.brands?.split(",")[0]?.trim() || null;
	const slug = matchFoodCategorySlug(off.categories_tags);
	const categoryId = slug ? (categorySlugToId?.get(slug) ?? null) : null;
	return {
		source: "OFF",
		sourceId: off.code,
		nameEn: off.product_name?.trim() || off.code,
		namePl: off.product_name_pl?.trim() || null,
		brand,
		categoryId,
		servingSizeG: null,
		imageUrl: off.image_url || null,
		imageThumbUrl: off.image_thumb_url || null,
		imageIngredientsUrl: off.image_ingredients_url || null,
		imageNutritionUrl: off.image_nutrition_url || null,
		nutrients: nutrientRows.map((r) => ({ nutrientId: r.nutrientId, amountPer100g: r.amountPer100g })),
	};
}

/**
 * Map a Meili hit's tagname-keyed `nutrients` map to a `nutrientId`-keyed draft for
 * edit prefill. Tags absent from `tagToId` are skipped; the map carries only present
 * values, so missing nutrients stay absent (rendered "brak danych"), never 0.
 * `categoryId` is left null — the caller resolves `categorySlug` → id if needed.
 */
export function meiliNutrientsToDraft(hit: FoodDocument, tagToId: Map<string, string>): DraftProduct {
	const nutrients: DraftNutrientValue[] = [];
	for (const [tag, amount] of Object.entries(hit.nutrients)) {
		const nutrientId = tagToId.get(tag);
		if (!nutrientId) continue;
		nutrients.push({ nutrientId, amountPer100g: amount });
	}
	return {
		source: hit.source as FoodSource,
		sourceId: hit.sourceId,
		nameEn: hit.nameEn,
		namePl: hit.namePl,
		brand: hit.brand,
		categoryId: null,
		servingSizeG: hit.servingSizeG,
		imageUrl: hit.imageUrl ?? null,
		imageThumbUrl: hit.imageThumbUrl ?? null,
		imageIngredientsUrl: hit.imageIngredientsUrl ?? null,
		imageNutritionUrl: hit.imageNutritionUrl ?? null,
		nutrients,
	};
}

/**
 * Normalize a draft into a save payload: preserves an explicit `0` and DROPS absent
 * (null) amounts, so a missing nutrient never lands as a row. Near-identity otherwise.
 */
export function draftToSavePayload(draft: DraftProduct): SavePayload {
	return {
		source: draft.source as SavePayload["source"],
		sourceId: draft.sourceId,
		nameEn: draft.nameEn,
		namePl: draft.namePl ?? null,
		brand: draft.brand ?? null,
		categoryId: draft.categoryId ?? null,
		servingSizeG: draft.servingSizeG ?? null,
		imageUrl: draft.imageUrl ?? null,
		imageThumbUrl: draft.imageThumbUrl ?? null,
		imageIngredientsUrl: draft.imageIngredientsUrl ?? null,
		imageNutritionUrl: draft.imageNutritionUrl ?? null,
		nutrients: draft.nutrients.filter((n) => n.amountPer100g !== null),
	};
}

/**
 * Split a draft's nutrient list into the rows to persist (present, including an
 * explicit `0`) and the nutrientIds to remove (set to null = "no data"). Used by the
 * edit-reconciliation path; pure so it is testable without a DB.
 */
export function partitionNutrients(nutrients: DraftNutrientValue[]): {
	present: Array<{ nutrientId: string; amountPer100g: number }>;
	removed: string[];
} {
	const present: Array<{ nutrientId: string; amountPer100g: number }> = [];
	const removed: string[] = [];
	for (const n of nutrients) {
		if (n.amountPer100g === null) removed.push(n.nutrientId);
		else present.push({ nutrientId: n.nutrientId, amountPer100g: n.amountPer100g });
	}
	return { present, removed };
}

/** Provenance rule: editing a verified (non-CUSTOM) product flags it as user-modified. */
export function shouldFlagUserModified(source: string): boolean {
	return source !== "CUSTOM";
}

/**
 * Resolve the persisted `sourceId` for a new product. A CUSTOM product without a
 * supplied id gets a freshly minted UUID (CUSTOM products are global, keyed by that
 * generated id); any verified source MUST carry its own id (an OFF barcode), so this
 * throws when one is missing. Pure given an injected generator, so the generation
 * rule is unit-testable without touching `crypto` directly.
 */
export function resolveSourceId(
	source: string,
	sourceId?: string,
	generate: () => string = () => crypto.randomUUID(),
): string {
	if (sourceId) return sourceId;
	if (source === "CUSTOM") return generate();
	throw new Error("sourceId is required for non-CUSTOM products");
}
