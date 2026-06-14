import { describe, it, expect } from "vitest";
import { buildStepStages, countNumberedSteps, numberSteps } from "./steps";
import type {
	RecipeComponentView,
	RecipeDetailView,
	RecipeStep,
	SubRecipeView,
	UnitView,
} from "$lib/recipe/schema";

// ─── Fixtures ─────────────────────────────────────────────────────────────────────

const action = (text: string): RecipeStep => ({ kind: "action", text, imageUrl: null });
const wait = (text: string, durationMin: number): RecipeStep => ({
	kind: "wait",
	text,
	durationMin,
});

const unit: UnitView = { slug: "g", namePl: "g", nameEn: "g", kind: "MASS" };

/** A parent component carrying a sub-recipe with the given steps. */
function subComponent(
	id: string,
	sub: Partial<SubRecipeView> & { name: string; steps: RecipeStep[] },
): RecipeComponentView {
	return {
		id,
		orderIndex: 0,
		amount: 1,
		note: null,
		gramsResolved: 100,
		unit,
		product: null,
		subRecipe: {
			id: `${id}-sub`,
			name: sub.name,
			nutritionComplete: true,
			prepTimeMin: sub.prepTimeMin ?? null,
			cookTimeMin: sub.cookTimeMin ?? null,
			steps: sub.steps,
			components: sub.components ?? [],
		},
	};
}

/** A plain product component (no sub-recipe). */
function productComponent(id: string): RecipeComponentView {
	return {
		id,
		orderIndex: 0,
		amount: 1,
		note: null,
		gramsResolved: 100,
		unit,
		product: { id: `${id}-p`, namePl: "Mąka", nameEn: "Flour" },
		subRecipe: null,
	};
}

function recipe(
	parts: Partial<Pick<RecipeDetailView, "components" | "steps">>,
): Pick<RecipeDetailView, "components" | "steps"> {
	return { components: parts.components ?? [], steps: parts.steps ?? [] };
}

// ─── numberSteps ────────────────────────────────────────────────────────────────────

describe("numberSteps", () => {
	it("numbers action steps sequentially and leaves wait-steps unnumbered", () => {
		const out = numberSteps([action("a"), wait("rest", 30), action("b")]);
		expect(out.map((s) => s.num)).toEqual([1, null, 2]);
	});

	it("uses positional keys, so duplicate wait-step text does not collide", () => {
		const out = numberSteps([wait("rest", 30), wait("rest", 30)]);
		expect(out.map((s) => s.key)).toEqual(["0", "1"]);
	});
});

// ─── buildStepStages ──────────────────────────────────────────────────────────────────

describe("buildStepStages", () => {
	it("returns [] when there are no steps anywhere", () => {
		expect(buildStepStages(recipe({}))).toEqual([]);
		expect(buildStepStages(recipe({ components: [productComponent("c1")] }))).toEqual([]);
	});

	it("renders a single flat 'main' stage when only parent steps exist", () => {
		const stages = buildStepStages(recipe({ steps: [action("mix"), action("bake")] }));
		expect(stages).toHaveLength(1);
		expect(stages[0]).toMatchObject({
			key: "main",
			title: null,
			timeLabel: null,
			omittedSubSteps: [],
		});
		expect(stages[0].items.map((i) => i.num)).toEqual([1, 2]);
	});

	it("ignores components whose sub-recipe has no steps (no stage produced)", () => {
		const stages = buildStepStages(
			recipe({
				components: [subComponent("c1", { name: "Sos", steps: [] })],
				steps: [action("mix")],
			}),
		);
		// Falls through to the flat 'main' list, NOT an assembly stage.
		expect(stages).toHaveLength(1);
		expect(stages[0].key).toBe("main");
	});

	it("builds a titled stage per sub-recipe with its own time label", () => {
		const stages = buildStepStages(
			recipe({
				components: [
					subComponent("c1", {
						name: "Sos",
						steps: [action("zagotuj")],
						prepTimeMin: 5,
						cookTimeMin: 10,
					}),
				],
			}),
		);
		expect(stages).toHaveLength(1);
		expect(stages[0]).toMatchObject({ key: "c1", title: "Sos", timeLabel: "15 min" });
	});

	it("appends a parent 'assembly' stage after sub-recipe stages, numbering reset per stage", () => {
		const stages = buildStepStages(
			recipe({
				components: [
					subComponent("c1", { name: "Sos", steps: [action("zagotuj"), action("zmiksuj")] }),
				],
				steps: [action("połącz"), action("podawaj")],
			}),
		);
		expect(stages.map((s) => s.key)).toEqual(["c1", "assembly"]);
		// Action numbering resets at the start of each stage.
		expect(stages[0].items.map((i) => i.num)).toEqual([1, 2]);
		expect(stages[1].items.map((i) => i.num)).toEqual([1, 2]);
		// The assembly title comes from i18n, not a hardcoded literal.
		expect(stages[1].title).toBeTruthy();
		expect(stages[1].title).not.toBe("recipe.detail.assembly");
	});

	it("omits the assembly stage when there are sub-stages but no parent steps", () => {
		const stages = buildStepStages(
			recipe({ components: [subComponent("c1", { name: "Sos", steps: [action("zagotuj")] })] }),
		);
		expect(stages.map((s) => s.key)).toEqual(["c1"]);
	});

	it("surfaces grandchild sub-recipes with steps via omittedSubSteps", () => {
		const stages = buildStepStages(
			recipe({
				components: [
					subComponent("c1", {
						name: "Baza",
						steps: [action("wymieszaj")],
						components: [
							{
								id: "gc1",
								amount: 1,
								gramsResolved: 50,
								note: null,
								unit,
								product: null,
								subRecipeName: "Zakwas",
								subRecipeHasSteps: true,
							},
							{
								id: "gc2",
								amount: 1,
								gramsResolved: 50,
								note: null,
								unit,
								product: null,
								subRecipeName: "Posypka",
								subRecipeHasSteps: false, // no steps → not omitted
							},
						],
					}),
				],
			}),
		);
		expect(stages[0].omittedSubSteps).toEqual(["Zakwas"]);
	});
});

// ─── countNumberedSteps ───────────────────────────────────────────────────────────────

describe("countNumberedSteps", () => {
	it("counts only numbered action steps across all stages", () => {
		const stages = buildStepStages(
			recipe({
				components: [
					subComponent("c1", { name: "Sos", steps: [action("a"), wait("rest", 30), action("b")] }),
				],
				steps: [action("c")],
			}),
		);
		// 2 actions in the sub-stage + 1 in assembly = 3; the wait-step is excluded.
		expect(countNumberedSteps(stages)).toBe(3);
	});

	it("is 0 for no stages", () => {
		expect(countNumberedSteps([])).toBe(0);
	});
});
