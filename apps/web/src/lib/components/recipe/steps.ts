/**
 * Pure step-staging derivation for the recipe detail view — turns a recipe's flat step list
 * plus its one-level sub-recipe composition into the staged "method" presentation the detail
 * panel renders. No I/O, no `$lib/server/*` (only the synchronous i18n `t()` and `./meta`
 * formatters): safe to import from client components, and unit-testable in isolation.
 *
 * Shape rules (locked by `browse-detail.html`):
 * - Each sub-recipe that carries its own steps becomes a stage (titled, with its own time).
 * - The parent's own steps become a final "assembly" stage — but only when sub-recipe stages
 *   exist; with none, the parent's steps render as a single flat numbered list (the simple probe).
 * - Action steps number sequentially **per stage**; wait-steps render as passive-time blocks
 *   (`num: null`, never numbered).
 * - The view flattens exactly ONE level of sub-recipe, so a grandchild sub-recipe with its own
 *   steps can't render — its name is surfaced via `omittedSubSteps` so the method stays an honest
 *   partial instead of a silent gap.
 */
import { formatMinutes, totalTime } from "./meta";
import { t } from "$lib/i18n";
import type { RecipeDetailView, RecipeStep } from "$lib/recipe/schema";

export type NumberedStep = { step: RecipeStep; num: number | null; key: string };

export type Stage = {
	key: string;
	title: string | null;
	timeLabel: string | null;
	items: NumberedStep[];
	/** Names of nested sub-recipes whose own steps this one-level-deep view can't show. */
	omittedSubSteps: string[];
};

/**
 * Number a step list for display: action steps get a running 1-based number, wait-steps get
 * `null`. `key` is a stable per-item index within the stage (NOT derived from text) — two
 * wait-steps with identical text in one stage must not collide into a duplicate `{#each}` key.
 */
export function numberSteps(steps: RecipeStep[]): NumberedStep[] {
	let n = 0;
	return steps.map((step, i) => ({ step, num: step.kind === "action" ? ++n : null, key: `${i}` }));
}

/**
 * Derive the method stages from a recipe's components + own steps. See the module header for
 * the shape rules. Takes only the two fields it reads so it stays decoupled from the full view.
 */
export function buildStepStages(recipe: Pick<RecipeDetailView, "components" | "steps">): Stage[] {
	const subStages: Stage[] = recipe.components
		.filter((c) => c.subRecipe && c.subRecipe.steps.length > 0)
		.map((c) => ({
			key: c.id,
			title: c.subRecipe!.name,
			timeLabel: formatMinutes(totalTime(c.subRecipe!.prepTimeMin, c.subRecipe!.cookTimeMin)),
			items: numberSteps(c.subRecipe!.steps),
			// A grandchild sub-recipe with its own steps can't render here (the view flattens
			// one level) — name it so the method is an honest partial, not a silent gap.
			omittedSubSteps: c
				.subRecipe!.components.filter((sc) => sc.subRecipeName && sc.subRecipeHasSteps)
				.map((sc) => sc.subRecipeName!),
		}));
	if (subStages.length === 0) {
		return recipe.steps.length > 0
			? [
					{
						key: "main",
						title: null,
						timeLabel: null,
						items: numberSteps(recipe.steps),
						omittedSubSteps: [],
					},
				]
			: [];
	}
	const assembly: Stage[] =
		recipe.steps.length > 0
			? [
					{
						key: "assembly",
						title: t("recipe.detail.assembly"),
						timeLabel: null,
						items: numberSteps(recipe.steps),
						omittedSubSteps: [],
					},
				]
			: [];
	return [...subStages, ...assembly];
}

/** Count of numbered (action) steps across all stages — wait-steps don't count. */
export function countNumberedSteps(stages: Stage[]): number {
	return stages.reduce((sum, s) => sum + s.items.filter((i) => i.num !== null).length, 0);
}
