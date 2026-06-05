import { NUTRIENT_REGISTRY } from '../../../scripts/data/nutrient-registry.js';

export interface OFFProduct {
	code: string;
	product_name: string;
	product_name_pl?: string;
	brands?: string;
	nutriments?: Record<string, number>;
	categories_tags?: string[];
	countries_tags?: string[];
	// Product photos (CC-BY-SA). Flat URL fields — see `offToDraft` for the draft mapping.
	image_url?: string;
	image_thumb_url?: string;
	image_ingredients_url?: string;
	image_nutrition_url?: string;
}

interface OFFSearchResponse {
	products?: OFFProduct[];
}

interface OFFProductResponse {
	status?: number;
	product?: OFFProduct;
}

/** A non-OK response from the OFF API, carrying the HTTP status so callers can map
 *  429 (rate limit) and 5xx/timeout to distinct user-facing states. */
export class OFFError extends Error {
	constructor(
		message: string,
		public status?: number,
	) {
		super(message);
		this.name = "OFFError";
	}
}

/** Fields requested from OFF (shared by search + single-product lookup). */
const OFF_FIELDS =
	"code,product_name,product_name_pl,brands,nutriments,categories_tags,countries_tags,image_url,image_thumb_url,image_ingredients_url,image_nutrition_url";

/** Maps OFF slug → { INFOODS tagname, conversion factor } derived from the Nutrient Registry. */
export const OFF_NUTRIENT_MAP: Map<string, { tag: string; factor: number }> = (() => {
	const map = new Map<string, { tag: string; factor: number }>();
	for (const entry of NUTRIENT_REGISTRY) {
		if (entry.off) {
			const slug = String(entry.off.id);
			map.set(slug, { tag: entry.tag, factor: entry.off.factor ?? 1 });
		}
		if (entry.offAliases) {
			for (const alias of entry.offAliases) {
				map.set(alias, { tag: entry.tag, factor: entry.off?.factor ?? 1 });
			}
		}
	}
	return map;
})();

/**
 * Maps OFF nutriments object to DB-ready nutrient rows.
 * Only processes *_100g keys; applies unit conversion factors from the registry.
 * Silently skips unknown slugs and tags not present in nutrientIdMap.
 */
export function buildNutrimentRows(
	nutriments: Record<string, number>,
	nutrientIdMap: Map<string, string>
): Array<{ nutrientId: string; amountPer100g: number }> {
	const rows: Array<{ nutrientId: string; amountPer100g: number }> = [];
	for (const [key, raw] of Object.entries(nutriments)) {
		if (!key.endsWith('_100g')) continue;
		const slug = key.slice(0, -5);
		const mapping = OFF_NUTRIENT_MAP.get(slug);
		if (!mapping) continue;
		const nutrientId = nutrientIdMap.get(mapping.tag);
		if (!nutrientId) continue;
		if (typeof raw !== 'number' || isNaN(raw)) continue;
		rows.push({ nutrientId, amountPer100g: raw * mapping.factor });
	}
	return rows;
}

const OFF_HEADERS = { 'User-Agent': 'LifeOS - Web - Version 1.0' };

export async function searchOFF(query: string, limit = 20): Promise<OFFProduct[]> {
	// Full-text search lives on the v1 `cgi/search.pl` endpoint. The v2 `/api/v2/search`
	// endpoint filters by tags only and *ignores* `search_terms`, so it returns the same
	// default product set regardless of the query (per OFF API docs: full-text search is
	// supported by the v1 API or the beta search-a-licious only). `search_simple=1` +
	// `action=process` runs the simple text search; the response keeps the same
	// `{ products: [...] }` shape, and `fields` trims it to what the mapper needs.
	const params = new URLSearchParams({
		search_terms: query,
		search_simple: "1",
		action: "process",
		json: "1",
		fields: OFF_FIELDS,
		page_size: String(limit),
	});
	let res: Response;
	try {
		res = await fetch(`https://pl.openfoodfacts.org/cgi/search.pl?${params}`, {
			headers: OFF_HEADERS,
		});
	} catch (err) {
		// Network/timeout — no HTTP status to surface.
		throw new OFFError(`OFF API request failed: ${String(err)}`);
	}
	if (!res.ok) {
		throw new OFFError(`OFF API error: ${res.status} ${res.statusText}`, res.status);
	}
	const data = (await res.json()) as OFFSearchResponse;
	return data.products ?? [];
}

/**
 * Single-product lookup by EAN barcode (the smart-input EAN path). Returns `null`
 * when OFF has no such product (HTTP 404 or `status: 0`), distinct from a transport
 * failure — which throws `OFFError` (with a `status` for 429 rate-limit handling).
 */
export async function getOFFProductByBarcode(barcode: string): Promise<OFFProduct | null> {
	const params = new URLSearchParams({ fields: OFF_FIELDS });
	let res: Response;
	try {
		res = await fetch(
			`https://pl.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?${params}`,
			{ headers: OFF_HEADERS },
		);
	} catch (err) {
		throw new OFFError(`OFF API request failed: ${String(err)}`);
	}
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new OFFError(`OFF API error: ${res.status} ${res.statusText}`, res.status);
	}
	const data = (await res.json()) as OFFProductResponse;
	// `status: 0` is OFF's "product not found" sentinel even on a 200 response.
	if (data.status === 0 || !data.product) return null;
	return data.product;
}
