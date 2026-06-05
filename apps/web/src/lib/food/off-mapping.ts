/**
 * OFF (Open Food Facts) → canonical-draft mapping. Pure, dependency-free (only the
 * shared `DraftProduct` type from `./schema`), so it's importable by the off-preview
 * service and unit-testable without I/O. Kept OUT of `schema.ts` — that file is the
 * generic client↔server contract (types + zod + draft↔payload adapters); this is the
 * OFF-specific domain mapping, consumed only by the OFF add path.
 */
import type { DraftProduct } from "./schema";

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
