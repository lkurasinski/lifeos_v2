/**
 * Sub-recipe graph safety — cycle prevention + nesting-depth bound.
 *
 * Pure over a caller-supplied adjacency list (`edges[parentId] = [childSubRecipeId, …]`,
 * an existing recipe → its current sub-recipe components). No DB access; the server
 * layer loads the edges and asserts these on save.
 */

/** Adjacency list: parent recipe id → ids of recipes it directly uses as sub-recipes. */
export type SubRecipeEdges = Record<string, string[]>;

export const DEFAULT_MAX_DEPTH = 5;

/**
 * Would linking `candidateChildId` as a sub-recipe of `parentId` create a cycle?
 *
 * A self-link is a cycle; otherwise a cycle forms iff the child can already reach the
 * parent through existing edges (so the new edge closes the loop). DFS from the child;
 * a `visited` set guards against pre-existing cycles in the supplied graph.
 */
export function wouldCreateCycle(
	parentId: string,
	candidateChildId: string,
	edges: SubRecipeEdges,
): boolean {
	if (parentId === candidateChildId) return true;

	const visited = new Set<string>();
	const stack = [candidateChildId];
	while (stack.length > 0) {
		const node = stack.pop()!;
		if (node === parentId) return true;
		if (visited.has(node)) continue;
		visited.add(node);
		for (const next of edges[node] ?? []) stack.push(next);
	}
	return false;
}

/**
 * Does the sub-recipe tree rooted at `rootId` nest deeper than `max` levels?
 *
 * Depth is the longest chain of sub-recipe edges from the root (a recipe with no
 * sub-recipes has depth 0). Memoized longest-path with an in-progress guard so a
 * pre-existing cycle in `edges` can't loop forever (a cycle is reported as exceeding).
 */
export function exceedsMaxDepth(
	rootId: string,
	edges: SubRecipeEdges,
	max: number = DEFAULT_MAX_DEPTH,
): boolean {
	const memo = new Map<string, number>();
	const inProgress = new Set<string>();

	const depthFrom = (node: string): number => {
		const cached = memo.get(node);
		if (cached !== undefined) return cached;
		// Re-entering a node still on the stack means a cycle — treat as unbounded.
		if (inProgress.has(node)) return Infinity;

		inProgress.add(node);
		let deepest = 0;
		for (const child of edges[node] ?? []) {
			deepest = Math.max(deepest, 1 + depthFrom(child));
		}
		inProgress.delete(node);
		memo.set(node, deepest);
		return deepest;
	};

	return depthFrom(rootId) > max;
}

// ─── Recompute fan-out support (integrity model A) ──────────────────────────────

/** Reverse adjacency: child recipe id → ids of recipes that use it as a sub-recipe. */
export type ParentEdges = Record<string, string[]>;

/**
 * Collect every recipe transitively ABOVE the seeds in the sub-recipe graph — the
 * parents of the seeds, their parents, and so on to a fixpoint. Used by the recompute
 * fan-out: when a product or sub-recipe changes, every dependent recipe up the graph
 * must be recomputed (never capped — see plan Critical Implementation Details).
 *
 * Does NOT include the seeds themselves (the caller decides whether the seeds also need
 * recomputing — they do for a product change, they're already done for a recipe change).
 * A `visited` set bounds the walk against any pre-existing cycle in `parentsOf`.
 */
export function collectTransitiveParents(seeds: string[], parentsOf: ParentEdges): Set<string> {
	const result = new Set<string>();
	const stack = [...seeds];
	while (stack.length > 0) {
		const node = stack.pop()!;
		for (const parent of parentsOf[node] ?? []) {
			if (!result.has(parent)) {
				result.add(parent);
				stack.push(parent);
			}
		}
	}
	return result;
}

/**
 * Order a set of recipe ids so each appears AFTER its sub-recipe children that are also
 * in the set (post-order / leaves-first). The recompute fan-out must process sub-recipes
 * before the parents that aggregate their cached totals, or a parent would roll up stale
 * child nutrition. Cycles are prevented on save, but an `inProgress` guard keeps a
 * malformed graph from looping forever.
 */
export function orderLeavesFirst(ids: string[], childrenOf: SubRecipeEdges): string[] {
	const inSet = new Set(ids);
	const result: string[] = [];
	const done = new Set<string>();
	const inProgress = new Set<string>();

	const visit = (node: string): void => {
		if (done.has(node) || inProgress.has(node)) return;
		inProgress.add(node);
		for (const child of childrenOf[node] ?? []) {
			if (inSet.has(child)) visit(child);
		}
		inProgress.delete(node);
		done.add(node);
		result.push(node);
	};

	for (const id of ids) visit(id);
	return result;
}
