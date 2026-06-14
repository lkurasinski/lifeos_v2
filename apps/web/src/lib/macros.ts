/**
 * The four macronutrients and their INFOODS tagnames — the single source of truth shared by the
 * nutrition engine, the pure Meili document builders, and the catalog/recipe gauge UI.
 *
 * Dependency-free (constants only), so it's safe to import from client components, server
 * services, and the tsx-loaded pure document modules alike.
 */

/** Macro key → its INFOODS tagname (the Nutrient PK). Promoted to dedicated cached columns. */
export const MACRO_TAGS = {
	energyKcal: "ENERC_KCAL",
	protein: "PROCNT",
	fat: "FAT",
	carbs: "CHOCDF",
} as const;

export type MacroKey = keyof typeof MACRO_TAGS;
export type MacroTag = (typeof MACRO_TAGS)[MacroKey];

/** Inverse map: INFOODS tagname → macro key. DERIVED from `MACRO_TAGS` so the two can't drift. */
export const MACRO_FIELDS: Record<string, MacroKey> = Object.fromEntries(
	Object.entries(MACRO_TAGS).map(([key, tag]) => [tag, key]),
) as Record<string, MacroKey>;
