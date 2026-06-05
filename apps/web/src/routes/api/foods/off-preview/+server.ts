import { json, error } from "@sveltejs/kit";
import { z } from "zod";
import { prisma } from "$lib/server/db";
import {
	searchOFF,
	getOFFProductByBarcode,
	buildNutrimentRows,
	OFFError,
	type OFFProduct,
} from "$lib/server/off";
import { getFoodCategories, getNutrientRegistry } from "$lib/server/food-products";
import { isBarcodeQuery, offToDraft, type PreviewResult } from "$lib/food/schema";
import type { RequestHandler } from "./$types";

/**
 * OFF preview — the no-write half of the human-in-the-loop add flow. Given a name or
 * an EAN barcode, fetch from Open Food Facts, map nutriments through the registry, and
 * return an editable canonical `DraftProduct` per result, flagging any that already
 * live in the catalog. NOTHING is written to the DB or Meilisearch here — that only
 * happens on an explicit Save (POST /api/foods), honoring the PRD accuracy guardrail.
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

	// Smart detection: 8–14 digits → barcode (single-product lookup); else free text.
	let offProducts: OFFProduct[];
	try {
		if (isBarcodeQuery(body.query)) {
			const product = await getOFFProductByBarcode(body.query.replace(/\s+/g, ""));
			offProducts = product ? [product] : [];
		} else {
			offProducts = await searchOFF(body.query);
		}
	} catch (err) {
		// Distinct per-state codes the UI maps to its own messages.
		if (err instanceof OFFError && err.status === 429) {
			error(429, "off_rate_limited");
		}
		error(502, "off_unavailable");
	}

	if (offProducts.length === 0) {
		return json({ results: [] });
	}

	// Registry tag→id map (memoized) drives the OFF nutriment mapping (factors applied
	// inside buildNutrimentRows). No second mapping table — the registry is canonical.
	// The category slug→id map lets OFF `categories_tags` pre-fill the form's category.
	const [{ tagToId }, categories] = await Promise.all([getNutrientRegistry(), getFoodCategories()]);
	const categorySlugToId = new Map(categories.map((c) => [c.slug, c.id]));

	// Dedup metadata: which of these barcodes already exist as OFF products.
	const codes = offProducts.map((p) => p.code).filter(Boolean);
	const existing = await prisma.foodProduct.findMany({
		where: { source: "OFF", sourceId: { in: codes } },
		select: { id: true, sourceId: true },
	});
	const existingByCode = new Map(existing.map((e) => [e.sourceId, e.id]));

	const results: PreviewResult[] = [];
	for (const product of offProducts) {
		if (!product.code) continue; // malformed entry → skip
		const rows = product.nutriments ? buildNutrimentRows(product.nutriments, tagToId) : [];
		const draft = offToDraft(product, rows, categorySlugToId);
		const existingId = existingByCode.get(product.code);
		results.push(existingId ? { draft, existing: { id: existingId } } : { draft });
	}

	return json({ results });
};
