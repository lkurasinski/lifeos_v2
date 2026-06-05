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
	categoryId?: string | null;
	servingSizeG?: number | null;
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

/** Create payload (manual CUSTOM or confirmed OFF). */
export const savePayloadSchema = z.object({
	source: z.enum(ADDABLE_SOURCES),
	sourceId: z.string().optional(),
	nameEn: z.string().trim().min(1).max(300),
	namePl: z.string().trim().max(300).nullable().optional(),
	categoryId: z.uuid().nullable().optional(),
	servingSizeG: z.number().min(0).nullable().optional(),
	nutrients: z.array(nutrientAmountSchema),
});
export type SavePayload = z.infer<typeof savePayloadSchema>;

/** Edit payload — the save payload minus the immutable identity fields. */
export const patchPayloadSchema = savePayloadSchema.omit({ source: true, sourceId: true });
export type PatchPayload = z.infer<typeof patchPayloadSchema>;

// ─── Pure adapters (no I/O) ───────────────────────────────────────────────────

/** Blank editable draft for manual entry. */
export function emptyDraft(source: FoodSource): DraftProduct {
	return {
		source,
		nameEn: "",
		namePl: null,
		categoryId: null,
		servingSizeG: null,
		nutrients: [],
	};
}

/**
 * Assemble a canonical OFF draft from the OFF product metadata and the
 * already-mapped, factor-applied nutrient rows (produced by `buildNutrimentRows`
 * in `$lib/server/off`, where the registry conversion factors live). The output
 * carries canonical-unit amounts only — no raw→converted annotation reaches the form.
 * No nutriments → an empty `nutrients` array → every field renders as "brak danych".
 */
export function offToDraft(
	off: { code: string; product_name?: string; product_name_pl?: string | null },
	nutrientRows: Array<{ nutrientId: string; amountPer100g: number }>,
): DraftProduct {
	return {
		source: "OFF",
		sourceId: off.code,
		nameEn: off.product_name?.trim() || off.code,
		namePl: off.product_name_pl?.trim() || null,
		categoryId: null,
		servingSizeG: null,
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
		categoryId: null,
		servingSizeG: hit.servingSizeG,
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
		categoryId: draft.categoryId ?? null,
		servingSizeG: draft.servingSizeG ?? null,
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
