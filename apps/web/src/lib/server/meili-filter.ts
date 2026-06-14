/**
 * Pure Meilisearch filter-clause helpers, shared by the food + recipe document modules.
 *
 * Dependency-free by design (like `food-document.ts` / `recipe-document.ts`): imports nothing
 * from the DB/Meili clients or `$env`, so the tsx batch reindex can still load the doc builders
 * that pull this in.
 */

/**
 * A disjunctive (OR) clause WITHIN one facet dimension, in Meili's nested-array filter form
 * (`[attr = "a", attr = "b"]`). `null` when the dimension has no active selection.
 *
 * Facet values are unconstrained free text from the URL (`z.array(z.string())`), so a raw `"`
 * or `\` would break out of the quoted filter literal (malformed filter → Meili 400). They are
 * ESCAPED here — defense-in-depth: the base visibility clause is a separate always-AND'd term,
 * so a value can't widen visibility, but it also must never be able to corrupt the filter string.
 */
export function orClause(attribute: string, values: string[] | undefined): string[] | null {
	if (!values || values.length === 0) return null;
	return values.map((v) => `${attribute} = "${v.replace(/(["\\])/g, "\\$1")}"`);
}
