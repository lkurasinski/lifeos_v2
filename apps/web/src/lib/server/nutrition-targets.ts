/**
 * Nutritional-targets persistence — the single home for reads/writes of a user's daily
 * targets. Each user owns at most one row (1:1 via the unique `userId`), so the write is an
 * upsert keyed by `userId` rather than separate create/update paths. Mirrors the per-user
 * ownership model used across the app (e.g. `recipes.ts`): every access is scoped to the
 * authenticated user's id, with no cross-user path.
 *
 * NULL ≠ 0: both the `create` and `update` branches write all four fields, so a cleared
 * field is persisted as `null` (not coerced to 0).
 */
import { prisma } from "$lib/server/db";
import type { NutritionTargetsPayload } from "$lib/nutrition-targets/schema";
import type { NutritionalTarget } from "../../generated/prisma/client";

/** Read the current user's targets, or `null` if they have never set any. */
export function getNutritionTargets(userId: string): Promise<NutritionalTarget | null> {
	return prisma.nutritionalTarget.findUnique({ where: { userId } });
}

/** Create-or-replace the current user's targets, persisting nulls as nulls. */
export function upsertNutritionTargets(
	userId: string,
	data: NutritionTargetsPayload,
): Promise<NutritionalTarget> {
	return prisma.nutritionalTarget.upsert({
		where: { userId },
		create: { userId, ...data },
		update: { ...data },
	});
}
