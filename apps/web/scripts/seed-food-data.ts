/**
 * Food product data pipeline.
 *
 * Usage:
 *   pnpm tsx scripts/seed-food-data.ts              # all implemented steps
 *   pnpm tsx scripts/seed-food-data.ts --step nutrients
 *   pnpm tsx scripts/seed-food-data.ts --step nutrients --reset
 *   pnpm tsx scripts/seed-food-data.ts --step usda
 *   pnpm tsx scripts/seed-food-data.ts --step translate
 *   pnpm tsx scripts/seed-food-data.ts --step index
 *   pnpm tsx scripts/seed-food-data.ts --step recipe-taxonomies
 *   pnpm tsx scripts/seed-food-data.ts --step recipe-index
 *   pnpm tsx scripts/seed-food-data.ts --step curate         # merge meat cats + prune to shortlists
 *   pnpm tsx scripts/seed-food-data.ts --step export-jsonl   # snapshot catalog → catalog.jsonl
 *   pnpm tsx scripts/seed-food-data.ts --step import-jsonl   # reseed catalog from catalog.jsonl
 *   pnpm tsx scripts/seed-food-data.ts --step import-jsonl --reset   # also prune products not in snapshot (1:1)
 *
 * Each step is idempotent. Run from apps/web/ so dotenv finds .env.
 * curate / export-jsonl / import-jsonl are step-only (not part of the default all-steps run).
 * On Railway: railway run pnpm tsx scripts/seed-food-data.ts
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Meilisearch } from 'meilisearch';
import { seedNutrients } from './steps/seed-nutrients.js';
import { importUsda } from './steps/import-usda.js';
import { translateProducts } from './steps/translate-products.js';
import { indexMeilisearch } from './steps/index-meilisearch.js';
import { seedRecipeTaxonomies } from './steps/seed-recipe-taxonomies.js';
import { indexRecipes } from './steps/index-recipes.js';
import { curateCatalog } from './steps/curate-catalog.js';
import { exportCatalogJsonl } from './steps/export-catalog-jsonl.js';
import { importFromJsonl } from './steps/import-from-jsonl.js';

const VALID_STEPS = [
	'nutrients',
	'usda',
	'translate',
	'index',
	'recipe-taxonomies',
	'recipe-index',
	'curate',
	'export-jsonl',
	'import-jsonl',
] as const;
type Step = (typeof VALID_STEPS)[number];

function parseStep(): Step | undefined {
	const idx = process.argv.indexOf('--step');
	if (idx === -1) return undefined;
	const val = process.argv[idx + 1];
	if (!VALID_STEPS.includes(val as Step)) {
		throw new Error(`Unknown --step "${val}". Valid: ${VALID_STEPS.join(', ')}`);
	}
	return val as Step;
}

function hasFlag(flag: string): boolean {
	return process.argv.includes(flag);
}

async function main() {
	const step = parseStep();
	const reset = hasFlag('--reset');

	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
	const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

	const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

	const meili = new Meilisearch({
		host: process.env.MEILISEARCH_HOST!,
		apiKey: process.env.MEILISEARCH_API_KEY,
	});


	try {
		if (!step || step === 'nutrients') {
			console.log('\n=== Step: nutrients ===');
			await seedNutrients(prisma, { reset });
		}
		if (!step || step === 'usda') {
			console.log('\n=== Step: usda ===');
			await importUsda(prisma);
		}
		if (!step || step === 'translate') {
			console.log('\n=== Step: translate ===');
			await translateProducts(prisma, anthropic);
		}
		if (!step || step === 'index') {
			console.log('\n=== Step: index ===');
			await indexMeilisearch(prisma, meili);
		}
		if (!step || step === 'recipe-taxonomies') {
			console.log('\n=== Step: recipe-taxonomies ===');
			await seedRecipeTaxonomies(prisma);
		}
		if (!step || step === 'recipe-index') {
			console.log('\n=== Step: recipe-index ===');
			await indexRecipes(prisma, meili);
		}
		// Step-only (excluded from the default all-steps run): one-time curation and the
		// JSONL snapshot/reset path.
		if (step === 'curate') {
			console.log('\n=== Step: curate ===');
			await curateCatalog(prisma);
		}
		if (step === 'export-jsonl') {
			console.log('\n=== Step: export-jsonl ===');
			await exportCatalogJsonl(prisma);
		}
		if (step === 'import-jsonl') {
			console.log('\n=== Step: import-jsonl ===');
			await importFromJsonl(prisma, { reset });
		}
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
