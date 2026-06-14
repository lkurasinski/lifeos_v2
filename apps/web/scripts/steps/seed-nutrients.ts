import { NUTRIENT_REGISTRY } from '../data/nutrient-registry.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

export async function seedNutrients(prisma: PrismaClient, options?: { reset?: boolean }) {
	if (options?.reset) {
		console.log('Resetting: deleting all food_nutrient and nutrient rows...');
		await prisma.foodNutrient.deleteMany();
		await prisma.nutrient.deleteMany();
		console.log('  Done.');
	}

	// INVARIANT: seed the FULL registry — never filter it here. `Nutrient.id` is the
	// INFOODS tagname (natural key), and the write paths (OFF `buildNutrimentRows`,
	// USDA `buildUsdaMap`) emit those tags straight as `FoodNutrient.nutrientId`. If a
	// tag referenced by OFF_NUTRIENT_MAP / the USDA registry weren't seeded, those
	// inserts would fail the FK (P2003). Full coverage is what keeps that FK safe.
	console.log(`Upserting ${NUTRIENT_REGISTRY.length} nutrients from registry...`);
	let upserted = 0;

	for (const entry of NUTRIENT_REGISTRY) {
		const usdaId = entry.usda ? (typeof entry.usda.id === 'number' ? entry.usda.id : null) : null;
		const offSlug = entry.off ? String(entry.off.id) : null;

		await prisma.nutrient.upsert({
			where: { id: entry.tag },
			create: {
				id: entry.tag,
				nameEn: entry.nameEn,
				namePl: entry.namePl,
				unit: entry.unit,
				category: entry.category,
				usdaNutrientId: usdaId,
				offSlug,
				displayRank: entry.displayRank,
			},
			update: {
				nameEn: entry.nameEn,
				namePl: entry.namePl,
				unit: entry.unit,
				category: entry.category,
				usdaNutrientId: usdaId,
				offSlug,
				displayRank: entry.displayRank,
			},
		});
		upserted++;
	}

	console.log(`  Upserted ${upserted} nutrients`);
}
