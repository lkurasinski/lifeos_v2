/**
 * Food product data pipeline.
 *
 * Usage:
 *   pnpm tsx scripts/seed-food-data.ts              # all implemented steps
 *   pnpm tsx scripts/seed-food-data.ts --step nutrients
 *   pnpm tsx scripts/seed-food-data.ts --step usda
 *   pnpm tsx scripts/seed-food-data.ts --step translate
 *   pnpm tsx scripts/seed-food-data.ts --step index
 *
 * Each step is idempotent. Run from apps/web/ so dotenv finds .env.
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

const VALID_STEPS = ['nutrients', 'usda', 'translate', 'index'] as const;
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

async function main() {
	const step = parseStep();

	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
	const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

	const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

	const meili = new Meilisearch({
		host: process.env.MEILISEARCH_HOST!,
		apiKey: process.env.MEILISEARCH_API_KEY,
	});

	void meili; // will be used in Phase 4

	try {
		if (!step || step === 'nutrients') {
			console.log('\n=== Step: nutrients ===');
			await seedNutrients(prisma, anthropic);
		}
		if (!step || step === 'usda') {
			console.log('\n=== Step: usda ===');
			await importUsda(prisma);
		}
		if (!step || step === 'translate') {
			console.log('\n=== Step: translate ===');
			await translateProducts(prisma, anthropic);
		}
		if (step === 'index') {
			console.log('\n=== Step: index (Phase 4 — not yet implemented) ===');
		}
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
