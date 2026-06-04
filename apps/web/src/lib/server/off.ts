import { NUTRIENT_REGISTRY } from '../../../scripts/data/nutrient-registry.js';

export interface OFFProduct {
	code: string;
	product_name: string;
	product_name_pl?: string;
	brands?: string;
	nutriments?: Record<string, number>;
	categories_tags?: string[];
	countries_tags?: string[];
}

interface OFFSearchResponse {
	products?: OFFProduct[];
}

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

export async function searchOFF(query: string, limit = 20): Promise<OFFProduct[]> {
	const params = new URLSearchParams({
		search_terms: query,
		fields: 'code,product_name,product_name_pl,brands,nutriments,categories_tags,countries_tags',
		page_size: String(limit),
	});
	const res = await fetch(`https://pl.openfoodfacts.org/api/v2/search?${params}`, {
		headers: { 'User-Agent': 'LifeOS - Web - Version 1.0' },
	});
	if (!res.ok) {
		throw new Error(`OFF API error: ${res.status} ${res.statusText}`);
	}
	const data = (await res.json()) as OFFSearchResponse;
	return data.products ?? [];
}
