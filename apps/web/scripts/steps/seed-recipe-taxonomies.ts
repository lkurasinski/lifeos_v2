import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
	UNITS,
	MEAL_TYPES,
	DIETS,
	TECHNIQUES,
	ALLERGENS,
	CUISINES,
	type TaxonomySeed,
} from '../data/recipe-taxonomies.js';

/**
 * Seed the household-unit set and the starter taxonomies (units, meal-types, diets,
 * techniques, allergens, cuisines). Idempotent: every row upserts by `slug`, so a
 * re-run leaves counts stable and refreshes the Polish/English labels. Seeded
 * Diet/Technique/Allergen rows leave `createdByUserId` NULL (NULL = seeded; a non-null
 * value marks a user-created entry added via find-or-create at authoring time).
 */
export async function seedRecipeTaxonomies(prisma: PrismaClient) {
	console.log(`Upserting ${UNITS.length} units...`);
	for (const u of UNITS) {
		await prisma.unit.upsert({
			where: { slug: u.slug },
			create: { slug: u.slug, namePl: u.namePl, nameEn: u.nameEn, kind: u.kind, baseFactor: u.baseFactor, displayRank: u.displayRank },
			update: { namePl: u.namePl, nameEn: u.nameEn, kind: u.kind, baseFactor: u.baseFactor, displayRank: u.displayRank },
		});
	}

	// Diet / Technique / Allergen carry `createdByUserId` (left unset → NULL = seeded).
	const upsertTaxonomy = async (
		label: string,
		rows: TaxonomySeed[],
		upsert: (row: TaxonomySeed) => Promise<unknown>,
	) => {
		console.log(`Upserting ${rows.length} ${label}...`);
		for (const row of rows) await upsert(row);
	};

	await upsertTaxonomy('meal types', MEAL_TYPES, (r) =>
		prisma.mealType.upsert({
			where: { slug: r.slug },
			create: { slug: r.slug, namePl: r.namePl, nameEn: r.nameEn },
			update: { namePl: r.namePl, nameEn: r.nameEn },
		}),
	);
	await upsertTaxonomy('diets', DIETS, (r) =>
		prisma.diet.upsert({
			where: { slug: r.slug },
			create: { slug: r.slug, namePl: r.namePl, nameEn: r.nameEn },
			update: { namePl: r.namePl, nameEn: r.nameEn },
		}),
	);
	await upsertTaxonomy('techniques', TECHNIQUES, (r) =>
		prisma.technique.upsert({
			where: { slug: r.slug },
			create: { slug: r.slug, namePl: r.namePl, nameEn: r.nameEn },
			update: { namePl: r.namePl, nameEn: r.nameEn },
		}),
	);
	await upsertTaxonomy('allergens', ALLERGENS, (r) =>
		prisma.allergen.upsert({
			where: { slug: r.slug },
			create: { slug: r.slug, namePl: r.namePl, nameEn: r.nameEn },
			update: { namePl: r.namePl, nameEn: r.nameEn },
		}),
	);
	await upsertTaxonomy('cuisines', CUISINES, (r) =>
		prisma.cuisine.upsert({
			where: { slug: r.slug },
			create: { slug: r.slug, namePl: r.namePl, nameEn: r.nameEn },
			update: { namePl: r.namePl, nameEn: r.nameEn },
		}),
	);

	console.log('  Done.');
}
