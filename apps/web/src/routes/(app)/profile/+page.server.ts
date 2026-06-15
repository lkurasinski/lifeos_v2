import { requireUserId } from "$lib/server/http";
import { getNutritionTargets } from "$lib/server/nutrition-targets";
import type { PageServerLoad } from "./$types";

// Auth is already enforced by `(app)/+layout.server.ts` (anonymous nav → /login);
// `requireUserId` re-narrows the viewer id for the ownership-scoped read.
export const load: PageServerLoad = async ({ locals }) => {
	const userId = requireUserId(locals);
	return { targets: await getNutritionTargets(userId) };
};
