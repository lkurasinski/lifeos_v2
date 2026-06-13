/**
 * Shared recipe-domain contracts — the client↔server boundary.
 *
 * Depends ONLY on `zod`. Imports nothing from `$lib/server/*` or `$env/*`, so it is
 * safe to import from client components (the authoring form, the live-nutrition panel),
 * from the server endpoints, and — type-only — from the dependency-free
 * `recipe-document.ts` the tsx batch reindex chain (Phase 4) loads.
 *
 * Everything nutrition-related is keyed by `infoodsTagname` — the single canonical
 * recipe-nutrition key (see `$lib/recipe/nutrition`). The `RecipeDocument` below is the
 * lean catalog read model (card-level fields + searchable/filterable/sortable
 * attributes); the full nutrient map + provenance live in Postgres and are read by
 * `getRecipeForView`, never round-tripped through Meili.
 */
import { z } from "zod";

// ─── Enums (mirror the Prisma enums; kept local so this stays Prisma-free) ──────

export const RECIPE_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export const RECIPE_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export type RecipeVisibility = (typeof RECIPE_VISIBILITIES)[number];

export const RECIPE_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type RecipeDifficulty = (typeof RECIPE_DIFFICULTIES)[number];

// ─── Read model: the Meilisearch document ───────────────────────────────────────

/**
 * The denormalized catalog read model — the only shape the browse cards + facets read.
 * Per-serving macros are promoted to top-level numerics so Meili can sort on them (it
 * cannot sort nested fields). An absent/null numeric is OMITTED, never stored as 0.
 * `tips`/`productNames`/`cuisineNamePl` are searchable; the slug arrays + difficulty +
 * visibility + ownerId are filterable. Only PUBLISHED recipes are ever indexed.
 */
export interface RecipeDocument {
	id: string;
	name: string;
	description: string | null;
	ownerId: string;
	visibility: RecipeVisibility;
	difficulty: RecipeDifficulty | null;
	mealTypeSlugs: string[];
	dietSlugs: string[];
	allergenSlugs: string[];
	techniqueSlugs: string[];
	cuisineSlug: string | null;
	/** Searchable join field — the cuisine's Polish name. */
	cuisineNamePl: string | null;
	/** Searchable join field — the component products' display names. */
	productNames: string[];
	tips: string[];
	servings: number;
	prepTimeMin: number | null;
	cookTimeMin: number | null;
	/** Sortable: prep + cook (null when both are absent). */
	totalTimeMin?: number;
	/** Sortable + card macro. */
	energyKcalPerServing?: number;
	/** Sortable + card macro. */
	proteinPerServing?: number;
	fatPerServing?: number;
	carbsPerServing?: number;
	/** Drives the neutral partial-nutrition card glyph. */
	nutritionComplete: boolean;
	/** Card thumbnail (upload-ready; absent in S-03). */
	imageUrl?: string;
}

// ─── Search params ────────────────────────────────────────────────────────────

export const RECIPE_SORT_KEYS = ["relevance", "kcal", "protein", "time", "name"] as const;
export type RecipeSortKey = (typeof RECIPE_SORT_KEYS)[number];

/** Browse scope segment (`browse-detail.html`): all / mine / public / my-drafts. */
export const RECIPE_SCOPES = ["wszystkie", "moje", "publiczne", "szkice"] as const;
export type RecipeScope = (typeof RECIPE_SCOPES)[number];

/** Normalized recipe search params (the endpoint pre-parses the URL into this). */
export const recipeSearchParamsSchema = z.object({
	q: z.string().trim().max(200).optional(),
	mealTypes: z.array(z.string()).optional(),
	diets: z.array(z.string()).optional(),
	allergens: z.array(z.string()).optional(),
	techniques: z.array(z.string()).optional(),
	cuisines: z.array(z.string()).optional(),
	difficulties: z.array(z.enum(RECIPE_DIFFICULTIES)).optional(),
	scope: z.enum(RECIPE_SCOPES).default("wszystkie"),
	sort: z.enum(RECIPE_SORT_KEYS).default("relevance"),
	dir: z.enum(["asc", "desc"]).default("asc"),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(24),
});
export type RecipeSearchParams = z.infer<typeof recipeSearchParamsSchema>;

/** The catalog search result — what `searchRecipes` (Phase 4) returns and the browse UI consumes. */
export interface RecipeSearchResult {
	hits: RecipeDocument[];
	total: number;
	page: number;
	limit: number;
	facets: {
		mealTypeSlugs: Record<string, number>;
		dietSlugs: Record<string, number>;
		allergenSlugs: Record<string, number>;
		techniqueSlugs: Record<string, number>;
		cuisineSlug: Record<string, number>;
		difficulty: Record<string, number>;
	};
}

/**
 * Parse a `URLSearchParams` into validated `RecipeSearchParams` (shared by the SSR page
 * load and the thin GET endpoint so both honor the same contract). Multi-value facet
 * keys accept repeated keys and/or comma-separated values; blank `q` and unparseable
 * `page`/`limit` fall back to defaults rather than 400ing, so hand-edited/shared URLs
 * stay resilient. An invalid `scope`/`sort`/`dir`/`difficulty` enum still throws (a real
 * client error the endpoint surfaces as 400). Mirrors `lib/food/schema.parseSearchParams`.
 */
export function parseRecipeSearchParams(searchParams: URLSearchParams): RecipeSearchParams {
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
	const difficulties = list("difficulties");

	return recipeSearchParamsSchema.parse({
		q: q ? q : undefined,
		mealTypes: list("mealTypes"),
		diets: list("diets"),
		allergens: list("allergens"),
		techniques: list("techniques"),
		cuisines: list("cuisines"),
		difficulties,
		scope: searchParams.get("scope") ?? undefined,
		sort: searchParams.get("sort") ?? undefined,
		dir: searchParams.get("dir") ?? undefined,
		page: num("page"),
		limit: num("limit"),
	});
}

// ─── Save / patch payloads ──────────────────────────────────────────────────────

/**
 * An ingredient amount. Accepts a JS `number` or a pl-PL comma-decimal string
 * (`"1,5"` → `1.5`) and must be strictly positive (a 0-gram component is meaningless).
 */
const amountSchema = z.preprocess(
	(v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v),
	z.number().positive().max(1_000_000),
);

/**
 * A taxonomy reference for the user-extensible vocabularies (diet/technique/allergen):
 * EXACTLY one of `id` (link an existing row) or `name` (find-or-create by normalized
 * slug at save time — the `Dodaj` chip in `form.html`).
 */
export const taxonomyRefSchema = z
	.object({
		id: z.uuid().optional(),
		name: z.string().trim().min(1).max(100).optional(),
	})
	.refine((r) => (r.id == null) !== (r.name == null), {
		message: "Provide exactly one of id or name",
	});
export type TaxonomyRef = z.infer<typeof taxonomyRefSchema>;

/**
 * A per-step image URL. Inert in S-03 (no upload pipeline yet) but stored verbatim and
 * later rendered in an `<img src>`, so this schema is the trust boundary: constrain to an
 * `http(s)` URL now — defense-in-depth so a `javascript:`/`data:`/`vbscript:` URI can never
 * land in the step JSON and become stored XSS once the render path exists. Absent/blank → null.
 */
const stepImageUrlSchema = z
	.string()
	.trim()
	.max(2048)
	.refine((u) => {
		try {
			const { protocol } = new URL(u);
			return protocol === "https:" || protocol === "http:";
		} catch {
			return false;
		}
	}, "image URL must be an http(s) URL")
	.nullable()
	.optional();

/**
 * A recipe step — a tagged union. `action` steps carry text + an optional image;
 * `wait` steps carry text + a required `durationMin` (passive time). Stages, the
 * start-ahead banner, and the active/passive split are DERIVED from this list at render
 * time — nothing extra is stored.
 */
export const recipeStepSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("action"),
		text: z.string().trim().min(1).max(4000),
		// Inert in S-03 (no upload pipeline yet); kept optional + nullable, upload-ready.
		imageUrl: stepImageUrlSchema,
	}),
	z.object({
		kind: z.literal("wait"),
		text: z.string().trim().min(1).max(4000),
		durationMin: z.number().int().positive().max(100_000),
	}),
]);
export type RecipeStep = z.infer<typeof recipeStepSchema>;

/**
 * One recipe component (line): EXACTLY one of `productId` / `subRecipeId`, plus an
 * amount + unit. `orderIndex` is NOT in the payload — the server derives it from array
 * position. The exactly-one invariant mirrors the raw CHECK constraint + the server assert.
 */
export const recipeComponentSchema = z
	.object({
		productId: z.uuid().nullable().optional(),
		subRecipeId: z.uuid().nullable().optional(),
		amount: amountSchema,
		unitId: z.uuid(),
		note: z.string().trim().max(500).nullable().optional(),
	})
	.refine((c) => (c.productId == null) !== (c.subRecipeId == null), {
		message: "Provide exactly one of productId or subRecipeId",
	});
export type RecipeComponentInput = z.infer<typeof recipeComponentSchema>;

/**
 * The create payload. A recipe can be created with a name alone (everything else
 * defaults) — minimal entry barrier per FR-003. `status`/`visibility` default to
 * DRAFT/PUBLIC; taxonomy ids are validated as UUIDs, diet/technique/allergen accept the
 * id-or-name find-or-create form.
 */
export const recipeSavePayloadSchema = z.object({
	name: z.string().trim().min(1).max(300),
	description: z.string().trim().max(5000).nullable().optional(),
	servings: z.number().int().min(1).max(1000).default(1),
	prepTimeMin: z.number().int().min(0).max(100_000).nullable().optional(),
	cookTimeMin: z.number().int().min(0).max(100_000).nullable().optional(),
	difficulty: z.enum(RECIPE_DIFFICULTIES).nullable().optional(),
	status: z.enum(RECIPE_STATUSES).default("DRAFT"),
	visibility: z.enum(RECIPE_VISIBILITIES).default("PUBLIC"),
	tips: z.array(z.string().trim().min(1).max(2000)).max(100).default([]),
	steps: z.array(recipeStepSchema).max(200).default([]),
	mealTypeIds: z.array(z.uuid()).max(50).default([]),
	cuisineId: z.uuid().nullable().optional(),
	diets: z.array(taxonomyRefSchema).max(50).default([]),
	techniques: z.array(taxonomyRefSchema).max(50).default([]),
	allergens: z.array(taxonomyRefSchema).max(50).default([]),
	components: z.array(recipeComponentSchema).max(200).default([]),
});
export type RecipeSavePayload = z.infer<typeof recipeSavePayloadSchema>;

/**
 * The edit payload. A recipe edit is a FULL replacement of the recipe's content (the
 * form always submits the complete draft), so the patch shape equals the save shape;
 * ownership comes from the session, never the body.
 */
export const recipePatchPayloadSchema = recipeSavePayloadSchema;
export type RecipePatchPayload = z.infer<typeof recipePatchPayloadSchema>;

// ─── Pure helpers (no I/O) ──────────────────────────────────────────────────────

/**
 * Normalize a free-text taxonomy name into a stable slug for find-or-create: lowercase,
 * strip Polish diacritics, collapse non-alphanumerics to single hyphens, trim hyphens.
 * Pure so the server and any client preview agree and it stays unit-testable. Two names
 * that differ only by case/diacritics/spacing collapse to the same slug (no duplicate row).
 */
export function normalizeTaxonomySlug(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "") // strip combining diacritics
		.replace(/ł/g, "l") // ł has no combining form — handle explicitly
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
