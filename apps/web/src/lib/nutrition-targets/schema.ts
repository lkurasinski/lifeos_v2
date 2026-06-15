/**
 * Shared nutrition-targets contract — the client↔server boundary.
 *
 * Depends only on `zod`; imports nothing from `$lib/server/*` or `$env/*`, so it is safe
 * to import from client components and from the API route alike.
 *
 * NULL ≠ 0: a field of `null` means "unset" and is distinct from a stored `0` (e.g. a user
 * who explicitly targets 0 g of a macro). The schema accepts `number | null` and the
 * service persists the distinction end-to-end.
 */
import { z } from "zod";

/** Transport/validation payload for the four daily targets. */
export const nutritionTargetsPayloadSchema = z.object({
	caloriesKcal: z.number().min(0).nullable(),
	proteinG: z.number().min(0).nullable(),
	carbsG: z.number().min(0).nullable(),
	fatG: z.number().min(0).nullable(),
});

export type NutritionTargetsPayload = z.infer<typeof nutritionTargetsPayloadSchema>;
