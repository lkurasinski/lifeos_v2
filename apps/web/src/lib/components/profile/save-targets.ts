import type { NutritionTargetsPayload } from "$lib/nutrition-targets/schema";

/**
 * Outcome of a targets save, decoupled from HTTP status + UI copy (mirrors
 * `save-product.ts`): `ok` on any 2xx, `error` on anything else incl. network failure.
 */
export type SaveOutcome = "ok" | "error";

/**
 * PUT the four nullable target fields to the singleton endpoint and reduce the response to a
 * `SaveOutcome`. The fetch/JSON/try-catch boilerplate lives here; the form owns its copy.
 */
export async function saveTargets(payload: NutritionTargetsPayload): Promise<SaveOutcome> {
	try {
		const res = await fetch("/api/nutrition-targets", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});
		return res.ok ? "ok" : "error";
	} catch {
		return "error";
	}
}
