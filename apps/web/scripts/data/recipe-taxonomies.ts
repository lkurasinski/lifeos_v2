/**
 * Recipe-domain reference data (S-03): the household-unit set and the starter
 * taxonomies. Polish-first (namePl is the primary label; nameEn is a fallback).
 *
 * Seeded rows are upserted by `slug` and carry `createdByUserId = NULL` (seeded,
 * not user-created). Diet / Technique / Allergen are *user-extensible* (find-or-create
 * by normalized slug at authoring time); MealType + Cuisine are closed seeded sets.
 *
 * Units: `baseFactor` is the multiplier to grams (MASS) or to ml (VOLUME). COUNT units
 * resolve via the product's `pieceWeightG` and ignore `baseFactor` (kept 1 as a no-op).
 */
import type { UnitKind } from '../../src/generated/prisma/client.js';

export interface UnitSeed {
	slug: string;
	namePl: string;
	nameEn: string;
	kind: UnitKind;
	baseFactor: number;
	displayRank: number;
}

export interface TaxonomySeed {
	slug: string;
	namePl: string;
	nameEn: string;
}

export const UNITS: UnitSeed[] = [
	// MASS → grams
	{ slug: 'g', namePl: 'g', nameEn: 'gram', kind: 'MASS', baseFactor: 1, displayRank: 1 },
	{ slug: 'dag', namePl: 'dag', nameEn: 'decagram', kind: 'MASS', baseFactor: 10, displayRank: 2 },
	{ slug: 'kg', namePl: 'kg', nameEn: 'kilogram', kind: 'MASS', baseFactor: 1000, displayRank: 3 },
	// VOLUME → ml (then ml→g via product densityGPerMl, default 1.0)
	{ slug: 'ml', namePl: 'ml', nameEn: 'milliliter', kind: 'VOLUME', baseFactor: 1, displayRank: 4 },
	{ slug: 'tsp', namePl: 'łyżeczka', nameEn: 'teaspoon', kind: 'VOLUME', baseFactor: 5, displayRank: 5 },
	{ slug: 'tbsp', namePl: 'łyżka', nameEn: 'tablespoon', kind: 'VOLUME', baseFactor: 15, displayRank: 6 },
	{ slug: 'cup', namePl: 'szklanka', nameEn: 'cup', kind: 'VOLUME', baseFactor: 250, displayRank: 7 },
	// COUNT → product pieceWeightG (baseFactor unused)
	{ slug: 'piece', namePl: 'szt.', nameEn: 'piece', kind: 'COUNT', baseFactor: 1, displayRank: 8 },
	{ slug: 'clove', namePl: 'ząbek', nameEn: 'clove', kind: 'COUNT', baseFactor: 1, displayRank: 9 },
];

// Closed seeded set, expanded with sub-recipe-oriented types (sos / baza / dodatek) so
// components like *Sos bolognese* / *Ciasto na pizzę* / *Beszamel* are categorizable.
export const MEAL_TYPES: TaxonomySeed[] = [
	{ slug: 'breakfast', namePl: 'Śniadanie', nameEn: 'Breakfast' },
	{ slug: 'lunch', namePl: 'Obiad', nameEn: 'Lunch' },
	{ slug: 'dinner', namePl: 'Kolacja', nameEn: 'Dinner' },
	{ slug: 'snack', namePl: 'Przekąska', nameEn: 'Snack' },
	{ slug: 'dessert', namePl: 'Deser', nameEn: 'Dessert' },
	{ slug: 'sauce', namePl: 'Sos', nameEn: 'Sauce' },
	{ slug: 'base', namePl: 'Baza', nameEn: 'Base' },
	{ slug: 'side', namePl: 'Dodatek', nameEn: 'Side' },
];

// Seeded but user-extensible. The diet group doubles as the attribute-tag vocabulary
// that carries the "Na zapas" badge seen in the browse/detail probes.
export const DIETS: TaxonomySeed[] = [
	{ slug: 'vegetarian', namePl: 'Wegetariańska', nameEn: 'Vegetarian' },
	{ slug: 'vegan', namePl: 'Wegańska', nameEn: 'Vegan' },
	{ slug: 'keto', namePl: 'Keto', nameEn: 'Keto' },
	{ slug: 'gluten-free', namePl: 'Bezglutenowa', nameEn: 'Gluten-free' },
	{ slug: 'high-protein', namePl: 'Wysokobiałkowa', nameEn: 'High-protein' },
	{ slug: 'low-calorie', namePl: 'Niskokaloryczna', nameEn: 'Low-calorie' },
	{ slug: 'batch', namePl: 'Na zapas', nameEn: 'Batch' },
];

// Seeded but user-extensible.
export const TECHNIQUES: TaxonomySeed[] = [
	{ slug: 'frying', namePl: 'Smażenie', nameEn: 'Frying' },
	{ slug: 'boiling', namePl: 'Gotowanie', nameEn: 'Boiling' },
	{ slug: 'baking', namePl: 'Pieczenie', nameEn: 'Baking' },
	{ slug: 'air-fryer', namePl: 'Air fryer', nameEn: 'Air fryer' },
	{ slug: 'grilling', namePl: 'Grillowanie', nameEn: 'Grilling' },
];

// Seeded but user-extensible.
export const ALLERGENS: TaxonomySeed[] = [
	{ slug: 'gluten', namePl: 'Gluten', nameEn: 'Gluten' },
	{ slug: 'lactose', namePl: 'Laktoza', nameEn: 'Lactose' },
	{ slug: 'nuts', namePl: 'Orzechy', nameEn: 'Nuts' },
	{ slug: 'eggs', namePl: 'Jaja', nameEn: 'Eggs' },
	{ slug: 'soy', namePl: 'Soja', nameEn: 'Soy' },
];

// Closed seeded set.
export const CUISINES: TaxonomySeed[] = [
	{ slug: 'polish', namePl: 'Polska', nameEn: 'Polish' },
	{ slug: 'italian', namePl: 'Włoska', nameEn: 'Italian' },
	{ slug: 'asian', namePl: 'Azjatycka', nameEn: 'Asian' },
	{ slug: 'mediterranean', namePl: 'Śródziemnomorska', nameEn: 'Mediterranean' },
	{ slug: 'french', namePl: 'Francuska', nameEn: 'French' },
	{ slug: 'mexican', namePl: 'Meksykańska', nameEn: 'Mexican' },
];
