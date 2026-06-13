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
