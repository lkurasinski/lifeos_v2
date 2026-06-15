// @vitest-environment node
/**
 * Integration tests for the recipe server layer + cross-entity integrity.
 *
 * No live DB: `$lib/server/db` (Prisma) and `$lib/server/search` (Meili) are mocked with
 * in-memory fakes. `$transaction` invokes its callback with the same mock so `recomputeRecipe`
 * runs against the configured `findUnique` fixtures. Each test wires only the Prisma methods
 * its path touches and asserts the downstream effects (cached nutrition, fan-out order, the
 * delete-blocks, the cycle rejection).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock, meiliMock } = vi.hoisted(() => {
	const index = {
		addDocuments: vi.fn().mockResolvedValue({ taskUid: 1 }),
		deleteDocument: vi.fn().mockResolvedValue({ taskUid: 1 }),
		deleteDocuments: vi.fn().mockResolvedValue({ taskUid: 1 }),
		updateSettings: vi.fn().mockResolvedValue({ taskUid: 1 }),
	};
	const meiliMock = {
		index: vi.fn(() => index),
		tasks: { waitForTask: vi.fn().mockResolvedValue({ status: "succeeded" }) },
	};
	const prismaMock = {
		recipe: {
			findUnique: vi.fn(),
			create: vi.fn().mockResolvedValue({ id: "created" }),
			update: vi.fn().mockResolvedValue({}),
			delete: vi.fn().mockResolvedValue({}),
			findMany: vi.fn().mockResolvedValue([]),
		},
		recipeComponent: {
			findMany: vi.fn().mockResolvedValue([]),
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			update: vi.fn().mockResolvedValue({}),
		},
		diet: { upsert: vi.fn().mockResolvedValue({ id: "diet" }) },
		technique: { upsert: vi.fn().mockResolvedValue({ id: "technique" }) },
		allergen: { upsert: vi.fn().mockResolvedValue({ id: "allergen" }) },
		foodProduct: { findUnique: vi.fn(), delete: vi.fn().mockResolvedValue({}) },
		$transaction: vi.fn(),
	};
	prismaMock.$transaction.mockImplementation((cb: (tx: typeof prismaMock) => unknown) =>
		cb(prismaMock),
	);
	return { prismaMock, meiliMock };
});

vi.mock("$lib/server/db", () => ({ prisma: prismaMock }));
vi.mock("$lib/server/search", () => ({ meili: meiliMock }));

import {
	createRecipe,
	updateRecipe,
	deleteRecipe,
	recomputeDependents,
	getRecipeDraftForEdit,
	RecipeInUseError,
	RecipeCycleError,
	RecipeNotFoundError,
	RecipeForbiddenError,
} from "../recipes.js";
import { deleteFoodProduct, FoodProductInUseError } from "../food-products.js";
import type { RecipeSavePayload } from "$lib/recipe/schema";
import { MACRO_TAGS } from "$lib/macros";

const gUnit = { id: "unit-g", kind: "MASS", baseFactor: 1 };

/** A product component row as `recomputeRecipe` loads it (unit + product + foodNutrients). */
function productComponent(
	id: string,
	productId: string,
	amount: number,
	nutrients: Record<string, number>,
	name = productId,
) {
	return {
		id,
		productId,
		subRecipeId: null,
		amount,
		unit: gUnit,
		product: {
			id: productId,
			namePl: name,
			nameEn: name,
			densityGPerMl: null,
			pieceWeightG: null,
			foodNutrients: Object.entries(nutrients).map(([nutrientId, amountPer100g]) => ({
				nutrientId,
				amountPer100g,
			})),
		},
		subRecipe: null,
	};
}

/** A sub-recipe component row carrying the sub-recipe's CACHED (totals, yieldWeightG). */
function subRecipeComponent(
	id: string,
	subRecipeId: string,
	amount: number,
	cached: { totals: Record<string, number>; yieldWeightG: number; nutritionComplete: boolean },
) {
	return {
		id,
		productId: null,
		subRecipeId,
		amount,
		unit: gUnit,
		product: null,
		subRecipe: {
			id: subRecipeId,
			name: subRecipeId,
			nutrients: cached.totals,
			yieldWeightG: cached.yieldWeightG,
			nutritionComplete: cached.nutritionComplete,
		},
	};
}

/** A full loaded recipe row (the `ROLLUP_INCLUDE` shape). */
function recipeRow(id: string, components: unknown[], over: Record<string, unknown> = {}) {
	return {
		id,
		userId: "u1",
		name: id,
		description: null,
		visibility: "PUBLIC",
		difficulty: null,
		servings: 1,
		prepTimeMin: null,
		cookTimeMin: null,
		tips: [],
		imageUrl: null,
		status: "PUBLISHED",
		energyKcalPerServing: null,
		proteinPerServing: null,
		fatPerServing: null,
		carbsPerServing: null,
		nutritionComplete: false,
		mealTypes: [],
		diets: [],
		allergens: [],
		techniques: [],
		cuisine: null,
		components,
		...over,
	};
}

/** Build a typed save payload from a partial (no Zod parse — the server takes parsed input). */
function payload(over: Partial<RecipeSavePayload>): RecipeSavePayload {
	return {
		name: "Recipe",
		servings: 1,
		status: "DRAFT",
		visibility: "PUBLIC",
		tips: [],
		steps: [],
		mealTypeIds: [],
		diets: [],
		techniques: [],
		allergens: [],
		components: [],
		...over,
	} as RecipeSavePayload;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createRecipe → caches rolled-up nutrition", () => {
	it("persists totals, per-serving projection, yield weight, and component grams", async () => {
		// 200 g chicken @ 165 kcal/100g, 31 g protein/100g; servings = 2.
		const row = recipeRow(
			"r1",
			[productComponent("c1", "chicken", 200, { ENERC_KCAL: 165, PROCNT: 31 })],
			{ servings: 2, status: "DRAFT" },
		);
		prismaMock.recipe.findUnique.mockResolvedValue(row);

		await createRecipe("u1", payload({ name: "Kurczak", servings: 2 }));

		expect(prismaMock.recipe.update).toHaveBeenCalledTimes(1);
		const data = prismaMock.recipe.update.mock.calls[0][0].data;
		expect(data.yieldWeightG).toBe(200);
		expect(data.energyKcalTotal).toBe(330); // 200/100 * 165
		expect(data.proteinTotal).toBe(62); // 200/100 * 31
		expect(data.energyKcalPerServing).toBe(165); // 330 / 2
		expect(data.proteinPerServing).toBe(31);
		expect(data.nutrients).toEqual({ ENERC_KCAL: 330, PROCNT: 62 });
		expect(data.nutritionComplete).toBe(true);
		// Component grams cached for the detail/form gram clarifier.
		expect(prismaMock.recipeComponent.update).toHaveBeenCalledWith({
			where: { id: "c1" },
			data: { gramsResolved: 200 },
		});
	});

	it("find-or-creates a new diet by normalized slug and links it", async () => {
		const row = recipeRow("r1", []);
		prismaMock.recipe.findUnique.mockResolvedValue(row);
		prismaMock.diet.upsert.mockResolvedValue({ id: "diet-paleo" });

		await createRecipe("u1", payload({ diets: [{ name: "Paleo" }] }));

		expect(prismaMock.diet.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { slug: "paleo" },
				create: expect.objectContaining({ slug: "paleo", createdByUserId: "u1" }),
			}),
		);
		expect(prismaMock.recipe.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ diets: { connect: [{ id: "diet-paleo" }] } }),
			}),
		);
	});
});

describe("recomputeDependents({ productId }) → fan-out up the sub-recipe graph", () => {
	it("recomputes the direct dependent AND its parent, children-first", async () => {
		// Graph: P (parent) uses S (sub-recipe); S maps an ingredient to product 'prod'.
		prismaMock.recipeComponent.findMany.mockImplementation(
			(args: { where: Record<string, unknown> }) => {
				const w = args.where;
				const sub = w.subRecipeId as { not?: unknown } | undefined;
				if (sub && typeof sub === "object" && "not" in sub) {
					return Promise.resolve([{ recipeId: "P", subRecipeId: "S" }]); // edges
				}
				if (w.productId !== undefined) {
					return Promise.resolve([{ recipeId: "S" }]); // S references the product
				}
				return Promise.resolve([]);
			},
		);

		const sRow = recipeRow("S", [productComponent("cs", "prod", 100, { ENERC_KCAL: 200 })]);
		const pRow = recipeRow("P", [
			subRecipeComponent("cp", "S", 100, {
				totals: { ENERC_KCAL: 200 },
				yieldWeightG: 100,
				nutritionComplete: true,
			}),
		]);
		prismaMock.recipe.findUnique.mockImplementation((args: { where: { id: string } }) =>
			Promise.resolve(args.where.id === "S" ? sRow : args.where.id === "P" ? pRow : null),
		);

		await recomputeDependents({ productId: "prod" });

		// Both S and P were recomputed, sub-recipe (S) BEFORE its parent (P).
		const updatedIds = prismaMock.recipe.update.mock.calls.map((c) => c[0].where.id);
		expect(updatedIds).toEqual(["S", "P"]);
	});

	it("is a no-op when no recipe references the changed product", async () => {
		prismaMock.recipeComponent.findMany.mockResolvedValue([]);
		await recomputeDependents({ productId: "orphan" });
		expect(prismaMock.recipe.update).not.toHaveBeenCalled();
	});
});

describe("delete-blocks (integrity model A)", () => {
	it("blocks deleting a recipe used as a sub-recipe, listing the referencing recipes", async () => {
		prismaMock.recipe.findUnique.mockResolvedValue({ userId: "u1" }); // ownership
		prismaMock.recipeComponent.findMany.mockResolvedValue([{ recipeId: "parent-1" }]);

		await expect(deleteRecipe("u1", "S")).rejects.toBeInstanceOf(RecipeInUseError);
		expect(prismaMock.recipe.delete).not.toHaveBeenCalled();

		await deleteRecipe("u1", "S").catch((err) => {
			expect(err).toBeInstanceOf(RecipeInUseError);
			expect((err as RecipeInUseError).referencingIds).toEqual(["parent-1"]);
		});
	});

	it("blocks deleting a product mapped by a recipe", async () => {
		prismaMock.foodProduct.findUnique.mockResolvedValue({ id: "prod" });
		prismaMock.recipeComponent.findMany.mockResolvedValue([{ recipeId: "r-9" }]);

		await expect(deleteFoodProduct("prod")).rejects.toBeInstanceOf(FoodProductInUseError);
		expect(prismaMock.foodProduct.delete).not.toHaveBeenCalled();
	});
});

describe("updateRecipe → cycle safety", () => {
	it("rejects a sub-recipe link that would create a cycle and never opens a transaction", async () => {
		prismaMock.recipe.findUnique.mockResolvedValue({ userId: "u1" }); // ownership
		// Existing edge: B already uses A as a sub-recipe → linking A → B closes the loop.
		prismaMock.recipeComponent.findMany.mockResolvedValue([{ recipeId: "B", subRecipeId: "A" }]);

		await expect(
			updateRecipe(
				"u1",
				"A",
				payload({ name: "A", components: [{ subRecipeId: "B", amount: 1, unitId: "unit-g" }] }),
			),
		).rejects.toBeInstanceOf(RecipeCycleError);
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});
});

describe("getRecipeDraftForEdit → narrowed nutrient fetch + draft projection", () => {
	it("loads only the four macro tags' foodNutrients, not the full ~74-row profile", async () => {
		prismaMock.recipe.findUnique.mockResolvedValue(
			recipeRow("r1", [productComponent("c1", "chicken", 200, { ENERC_KCAL: 165, PROCNT: 31 })], {
				cuisineId: null,
			}),
		);

		await getRecipeDraftForEdit("u1", "r1");

		// `select` narrows columns; the row narrowing has to come from a `where` on the relation.
		const include = prismaMock.recipe.findUnique.mock.calls[0][0].include;
		expect(include.components.include.product.select.foodNutrients.where).toEqual({
			nutrientId: { in: Object.values(MACRO_TAGS) },
		});
	});

	it("maps a product component into the live-panel preview payload", async () => {
		prismaMock.recipe.findUnique.mockResolvedValue(
			recipeRow("r1", [productComponent("c1", "chicken", 200, { ENERC_KCAL: 165, PROCNT: 31 })], {
				cuisineId: null,
			}),
		);

		const draft = await getRecipeDraftForEdit("u1", "r1");

		expect(draft.components).toHaveLength(1);
		expect(draft.components[0]).toMatchObject({
			productId: "chicken",
			subRecipeId: null,
			amount: 200,
			preview: { nutrientsPer100g: { ENERC_KCAL: 165, PROCNT: 31 } },
		});
	});

	it("enforces owner-only access (forbidden) and rejects a missing recipe", async () => {
		prismaMock.recipe.findUnique.mockResolvedValue(
			recipeRow("r1", [], { userId: "owner", cuisineId: null }),
		);
		await expect(getRecipeDraftForEdit("intruder", "r1")).rejects.toBeInstanceOf(
			RecipeForbiddenError,
		);

		prismaMock.recipe.findUnique.mockResolvedValue(null);
		await expect(getRecipeDraftForEdit("u1", "missing")).rejects.toBeInstanceOf(
			RecipeNotFoundError,
		);
	});
});
