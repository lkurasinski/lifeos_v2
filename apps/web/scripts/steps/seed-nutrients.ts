import { NUTRIENT_REGISTRY } from '../data/nutrient-registry.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

export async function seedNutrients(prisma: PrismaClient, options?: { reset?: boolean }) {
	if (options?.reset) {
		console.log('Resetting: deleting all food_nutrient and nutrient rows...');
		await prisma.foodNutrient.deleteMany();
		await prisma.nutrient.deleteMany();
		console.log('  Done.');
	}

	console.log(`Upserting ${NUTRIENT_REGISTRY.length} nutrients from registry...`);
	let upserted = 0;

	for (const entry of NUTRIENT_REGISTRY) {
		const usdaId = entry.usda ? (typeof entry.usda.id === 'number' ? entry.usda.id : null) : null;
		const offSlug = entry.off ? String(entry.off.id) : null;

		await prisma.nutrient.upsert({
			where: { infoodsTagname: entry.tag },
			create: {
				infoodsTagname: entry.tag,
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
