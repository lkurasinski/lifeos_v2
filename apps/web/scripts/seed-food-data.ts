/**
 * Food product data pipeline.
 *
 * `data/catalog-seed/catalog.jsonl` is the SINGLE SOURCE OF TRUTH for the food catalog.
 * It is committed, id-stable, and the only reseed path. The USDA import that originally
 * produced it is retired — see scripts/legacy/README.md.
 *
 * Usage:
 *   pnpm tsx scripts/seed-food-data.ts              # full bootstrap (all steps below, in order)
 *   pnpm tsx scripts/seed-food-data.ts --reset      # full REBUILD — see the warning below
 *   pnpm tsx scripts/seed-food-data.ts --step import-jsonl --reset --force  # ... incl. app-created products
 *   pnpm tsx scripts/seed-food-data.ts --step nutrients
 *   pnpm tsx scripts/seed-food-data.ts --step import-jsonl   # reseed catalog from catalog.jsonl
 *   pnpm tsx scripts/seed-food-data.ts --step index
 *   pnpm tsx scripts/seed-food-data.ts --step recipe-taxonomies
 *   pnpm tsx scripts/seed-food-data.ts --step recipe-index
 *   pnpm tsx scripts/seed-food-data.ts --step export-jsonl   # snapshot catalog → catalog.jsonl
 *
 * Curation loop: curate in the app (locally) → `--step export-jsonl` → commit the snapshot
 * → publish to Railway. Work done on a deployed database is NOT a source of truth and is
 * overwritten by the next publish.
 *
 * `--reset` applies to both `nutrients` (deletes every nutrient + food_nutrient row) and
 * `import-jsonl` (prunes products absent from the snapshot). The prune keeps anything a recipe
 * references, and keeps app-created (OFF / CUSTOM) products unless `--force` is passed, since
 * those exist in no other place. EXPORT FIRST anyway: `--reset` on the full run wipes nutrient
 * rows via the `nutrients` step, which no guard covers.
 *
 * export-jsonl is step-only (never part of the default run): it WRITES the snapshot, so it
 * must be an explicit act.
 *
 * Each step is idempotent. Run from apps/web/ so dotenv finds .env.
 * On Railway: railway run pnpm tsx scripts/seed-food-data.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Meilisearch } from "meilisearch";
import { seedNutrients } from "./steps/seed-nutrients.js";
import { indexMeilisearch } from "./steps/index-meilisearch.js";
import { seedRecipeTaxonomies } from "./steps/seed-recipe-taxonomies.js";
import { indexRecipes } from "./steps/index-recipes.js";
import { exportCatalogJsonl } from "./steps/export-catalog-jsonl.js";
import { importFromJsonl } from "./steps/import-from-jsonl.js";

const VALID_STEPS = [
	"nutrients",
	"import-jsonl",
	"index",
	"recipe-taxonomies",
	"recipe-index",
	"export-jsonl",
] as const;
type Step = (typeof VALID_STEPS)[number];

function parseStep(): Step | undefined {
	const idx = process.argv.indexOf("--step");
	if (idx === -1) return undefined;
	const val = process.argv[idx + 1];
	if (!VALID_STEPS.includes(val as Step)) {
		throw new Error(`Unknown --step "${val}". Valid: ${VALID_STEPS.join(", ")}`);
	}
	return val as Step;
}

function hasFlag(flag: string): boolean {
	return process.argv.includes(flag);
}

async function main() {
	const step = parseStep();
	const reset = hasFlag("--reset");
	const force = hasFlag("--force");

	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
	const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

	const meili = new Meilisearch({
		host: process.env.MEILISEARCH_HOST!,
		apiKey: process.env.MEILISEARCH_API_KEY,
	});

	try {
		if (!step || step === "nutrients") {
			console.log("\n=== Step: nutrients ===");
			await seedNutrients(prisma, { reset });
		}
		if (!step || step === "import-jsonl") {
			console.log("\n=== Step: import-jsonl ===");
			await importFromJsonl(prisma, { reset, force });
		}
		if (!step || step === "index") {
			console.log("\n=== Step: index ===");
			await indexMeilisearch(prisma, meili);
		}
		if (!step || step === "recipe-taxonomies") {
			console.log("\n=== Step: recipe-taxonomies ===");
			await seedRecipeTaxonomies(prisma);
		}
		if (!step || step === "recipe-index") {
			console.log("\n=== Step: recipe-index ===");
			await indexRecipes(prisma, meili);
		}
		// Step-only (never part of the default run): writing the snapshot is an explicit act.
		if (step === "export-jsonl") {
			console.log("\n=== Step: export-jsonl ===");
			await exportCatalogJsonl(prisma);
		}
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
