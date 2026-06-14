// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
	wouldCreateCycle,
	exceedsMaxDepth,
	collectTransitiveParents,
	orderLeavesFirst,
	type SubRecipeEdges,
	type ParentEdges,
} from "./graph.js";

describe("wouldCreateCycle", () => {
	it("rejects a self-link", () => {
		expect(wouldCreateCycle("a", "a", {})).toBe(true);
	});

	it("allows linking an unrelated child", () => {
		const edges: SubRecipeEdges = { a: ["b"], c: [] };
		expect(wouldCreateCycle("a", "c", edges)).toBe(false);
	});

	it("rejects a direct cycle (child already uses the parent)", () => {
		// b → a exists; linking a → b would close the loop.
		const edges: SubRecipeEdges = { b: ["a"] };
		expect(wouldCreateCycle("a", "b", edges)).toBe(true);
	});

	it("rejects an indirect cycle (child reaches the parent transitively)", () => {
		// c → d → a exists; linking a → c would close a longer loop.
		const edges: SubRecipeEdges = { c: ["d"], d: ["a"] };
		expect(wouldCreateCycle("a", "c", edges)).toBe(true);
	});

	it("does not loop forever on a pre-existing cycle in the graph", () => {
		const edges: SubRecipeEdges = { x: ["y"], y: ["x"] };
		expect(wouldCreateCycle("a", "x", edges)).toBe(false);
	});
});

describe("exceedsMaxDepth", () => {
	it("treats a leaf (no sub-recipes) as depth 0", () => {
		expect(exceedsMaxDepth("a", {}, 5)).toBe(false);
		expect(exceedsMaxDepth("a", { a: [] }, 5)).toBe(false);
	});

	it("counts the longest chain of edges from the root", () => {
		// a → b → c → d → e → f = 5 edges = depth 5, exactly at the cap.
		const edges: SubRecipeEdges = { a: ["b"], b: ["c"], c: ["d"], d: ["e"], e: ["f"] };
		expect(exceedsMaxDepth("a", edges, 5)).toBe(false);
	});

	it("flags a chain deeper than the cap", () => {
		// a → b → c → d → e → f → g = 6 edges = depth 6 > 5.
		const edges: SubRecipeEdges = { a: ["b"], b: ["c"], c: ["d"], d: ["e"], e: ["f"], f: ["g"] };
		expect(exceedsMaxDepth("a", edges, 5)).toBe(true);
	});

	it("uses the deepest branch when a node fans out", () => {
		// a → b (leaf) and a → c → d → e → f → g (5 deep) → depth 5.
		const edges: SubRecipeEdges = { a: ["b", "c"], c: ["d"], d: ["e"], e: ["f"], f: ["g"] };
		expect(exceedsMaxDepth("a", edges, 5)).toBe(false);
		expect(exceedsMaxDepth("a", edges, 4)).toBe(true);
	});

	it("defaults to a max depth of 5", () => {
		const edges: SubRecipeEdges = { a: ["b"], b: ["c"], c: ["d"], d: ["e"], e: ["f"], f: ["g"] };
		expect(exceedsMaxDepth("a", edges)).toBe(true);
	});

	it("reports a cycle as exceeding rather than looping forever", () => {
		const edges: SubRecipeEdges = { a: ["b"], b: ["a"] };
		expect(exceedsMaxDepth("a", edges, 5)).toBe(true);
	});

	it("handles max = 0 (any sub-recipe at all exceeds)", () => {
		expect(exceedsMaxDepth("a", {}, 0)).toBe(false);
		expect(exceedsMaxDepth("a", { a: ["b"] }, 0)).toBe(true);
	});

	it("tolerates a child id that is not itself a key (dangling leaf)", () => {
		// b and c have no entries of their own — treated as leaves.
		expect(exceedsMaxDepth("a", { a: ["b", "c"] }, 5)).toBe(false);
	});

	it("does not blow up on a diamond DAG (memo reuses shared sub-trees)", () => {
		// a → {b, c}; b → d; c → d; d → e. Longest path a→b→d→e = 3 edges.
		const edges: SubRecipeEdges = { a: ["b", "c"], b: ["d"], c: ["d"], d: ["e"] };
		expect(exceedsMaxDepth("a", edges, 5)).toBe(false);
		expect(exceedsMaxDepth("a", edges, 2)).toBe(true);
	});
});

describe("collectTransitiveParents", () => {
	// childId → recipes that use it as a sub-recipe.
	// sauce ← ragu ← lasagne; sauce ← pizza. (lasagne uses ragu, ragu+pizza use sauce.)
	const parentsOf: ParentEdges = { sauce: ["ragu", "pizza"], ragu: ["lasagne"] };

	it("collects direct + transitive parents, excluding the seed itself", () => {
		const result = collectTransitiveParents(["sauce"], parentsOf);
		expect(result).toEqual(new Set(["ragu", "pizza", "lasagne"]));
		expect(result.has("sauce")).toBe(false);
	});

	it("returns an empty set for a top-level recipe with no parents", () => {
		expect(collectTransitiveParents(["lasagne"], parentsOf)).toEqual(new Set());
	});

	it("merges ancestors across multiple seeds without duplication", () => {
		const result = collectTransitiveParents(["sauce", "ragu"], parentsOf);
		expect(result).toEqual(new Set(["ragu", "pizza", "lasagne"]));
	});

	it("terminates on a pre-existing cycle in the parent graph", () => {
		const cyclic: ParentEdges = { x: ["y"], y: ["x"] };
		expect(collectTransitiveParents(["x"], cyclic)).toEqual(new Set(["x", "y"]));
	});
});

describe("orderLeavesFirst", () => {
	it("orders each recipe after its in-set sub-recipe children", () => {
		// lasagne → ragu → sauce (children-of edges).
		const childrenOf: SubRecipeEdges = { lasagne: ["ragu"], ragu: ["sauce"] };
		const order = orderLeavesFirst(["lasagne", "ragu", "sauce"], childrenOf);
		expect(order.indexOf("sauce")).toBeLessThan(order.indexOf("ragu"));
		expect(order.indexOf("ragu")).toBeLessThan(order.indexOf("lasagne"));
	});

	it("ignores children that are outside the affected set", () => {
		// ragu → sauce, but sauce is not in the set → treated as a leaf dependency.
		const childrenOf: SubRecipeEdges = { ragu: ["sauce"] };
		expect(orderLeavesFirst(["ragu"], childrenOf)).toEqual(["ragu"]);
	});

	it("does not loop forever on a malformed cyclic graph", () => {
		const childrenOf: SubRecipeEdges = { a: ["b"], b: ["a"] };
		const order = orderLeavesFirst(["a", "b"], childrenOf);
		expect(new Set(order)).toEqual(new Set(["a", "b"]));
		expect(order).toHaveLength(2);
	});
});
