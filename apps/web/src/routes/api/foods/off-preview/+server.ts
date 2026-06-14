import { json } from "@sveltejs/kit";
import { z } from "zod";
import { buildOffPreview } from "$lib/server/food-products";
import { requireUser, parseJsonBody, mapServiceError } from "$lib/server/http";
import type { RequestHandler } from "./$types";

/**
 * OFF preview — the no-write half of the human-in-the-loop add flow. Thin controller:
 * guard → parse → `buildOffPreview` (the service does the OFF fetch + registry mapping +
 * dedup) → `mapServiceError` translates OFF transport failures to per-state codes. NOTHING
 * is written to the DB or Meilisearch here — that only happens on an explicit Save
 * (POST /api/foods), honoring the PRD accuracy guardrail.
 */
const bodySchema = z.object({
	query: z.string().trim().min(1).max(200),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	requireUser(locals);
	const body = await parseJsonBody(request, bodySchema, "Nieprawidłowe zapytanie");

	try {
		return json({ results: await buildOffPreview(body.query) });
	} catch (err) {
		return mapServiceError(err);
	}
};
