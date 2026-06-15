/**
 * Pure form logic for the editable product surface (`ProductForm`) — the raw-input amount
 * parser, the one-time seed snapshot, and the save-time draft assembly. No I/O, no
 * `$lib/server/*`: safe to import from client components and unit-testable. These functions
 * carry the NULL ≠ 0 integrity rule end-to-end (an empty field is "no data", distinct from a
 * typed 0), so they are tested directly rather than only through the UI.
 */
import { parseDecimalPl } from "$lib/decimal";
import type { DraftNutrientValue, DraftProduct, NutrientRegistryGroup } from "$lib/food/schema";

/**
 * A nutrient/conversion field's runtime value. A `type="number"` `bind:value` yields a NUMBER
 * (or `null` when emptied); the initial seed and the comma-decimal text path yield a string.
 */
export type AmountField = string | number | null;

/** The editable form's flat field state — the seed produces it, the draft assembly consumes it. */
export type ProductFormFields = {
	nameEn: string;
	namePl: string;
	brand: string;
	categoryId: string;
	servingSizeG: AmountField;
	densityGPerMl: AmountField;
	pieceWeightG: AmountField;
	/** Raw nutrient inputs keyed by nutrientId (= INFOODS tagname); "" / null = NULL (no data). */
	values: Record<string, AmountField>;
};

/**
 * Parse a raw field into a canonical amount. A number input binds as a number (or null when
 * empty); the seed and text fallback bind as a string. Empty/blank/null → null (NULL ≠ 0); a
 * typed `0` stays `0`. Accepts comma decimals for the string path. The product domain keeps no
 * sign guard (the shared {@link parseDecimalPl} kernel is used as-is).
 */
export function parseAmount(raw: AmountField | undefined): number | null {
	return parseDecimalPl(raw);
}

/**
 * Snapshot a draft into editable form fields. Nutrient values are seeded ONLY with present
 * (non-null) amounts — an absent nutrient stays out of `values`, i.e. NULL (no data), not 0.
 */
export function seedFields(draft: DraftProduct): ProductFormFields {
	const values: Record<string, AmountField> = {};
	for (const n of draft.nutrients) {
		if (n.amountPer100g !== null) values[n.nutrientId] = n.amountPer100g;
	}
	return {
		nameEn: draft.nameEn,
		namePl: draft.namePl ?? "",
		brand: draft.brand ?? "",
		categoryId: draft.categoryId ?? "",
		servingSizeG: draft.servingSizeG ?? null,
		densityGPerMl: draft.densityGPerMl ?? null,
		pieceWeightG: draft.pieceWeightG ?? null,
		values,
	};
}

/**
 * Assemble the canonical `DraftProduct` to save from the current form fields. Emits EVERY
 * registry nutrient — present values keep their amount, empties become null (the parent's
 * create/patch normalization decides whether to drop or clear them; both honor NULL ≠ 0).
 * `nameEn` is schema-required, so it falls back to the Polish name when only that is filled.
 * Source identity and the (non-edited) OFF photo URLs are carried through from the source draft.
 */
export function buildDraftProduct(
	fields: ProductFormFields,
	source: DraftProduct,
	registry: NutrientRegistryGroup[],
): DraftProduct {
	const nutrients: DraftNutrientValue[] = [];
	for (const group of registry) {
		for (const n of group.nutrients) {
			nutrients.push({ nutrientId: n.id, amountPer100g: parseAmount(fields.values[n.id]) });
		}
	}
	return {
		source: source.source,
		sourceId: source.sourceId,
		nameEn: fields.nameEn.trim() || fields.namePl.trim(),
		namePl: fields.namePl.trim() || null,
		brand: fields.brand.trim() || null,
		categoryId: fields.categoryId || null,
		servingSizeG: parseAmount(fields.servingSizeG),
		densityGPerMl: parseAmount(fields.densityGPerMl),
		pieceWeightG: parseAmount(fields.pieceWeightG),
		imageUrl: source.imageUrl ?? null,
		imageThumbUrl: source.imageThumbUrl ?? null,
		imageIngredientsUrl: source.imageIngredientsUrl ?? null,
		imageNutritionUrl: source.imageNutritionUrl ?? null,
		nutrients,
	};
}
