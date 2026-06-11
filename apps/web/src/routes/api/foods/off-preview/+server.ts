import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { OFFError } from "$lib/server/off";
import { buildOffPreview } from "$lib/server/food-products";
import type { RequestHandler } from "./$types";

/**
 * OFF preview — the no-write half of the human-in-the-loop add flow. Thin controller:
 * guard → parse → `buildOffPreview` (the service does the OFF fetch + registry mapping +
 * dedup) → map OFF transport failures to per-state codes. NOTHING is written to the DB or
 * Meilisearch here — that only happens on an explicit Save (POST /api/foods), honoring the
 * PRD accuracy guardrail.
 */
const bodySchema = z.object({
	query: z.string().trim().min(1).max(200),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) {
		error(401, "Unauthorized");
	}

	let body: z.infer<typeof bodySchema>;
	try {
		body = bodySchema.parse(await request.json());
	} catch {
		error(400, "Nieprawidłowe zapytanie");
	}

	try {
		return json({ results: await buildOffPreview(body.query) });
	} catch (err) {
		// Distinct per-state codes the UI maps to its own messages; non-OFF errors
		// (e.g. DB) propagate as a genuine 500.
		if (err instanceof OFFError) {
			error(err.status === 429 ? 429 : 502, err.status === 429 ? "off_rate_limited" : "off_unavailable");
		}
		throw err;
	}
};
