/**
 * Step: import-jsonl
 *
 * Reseeds the catalog from the JSONL snapshot — the canonical (and only) reseed path. The
 * replay logic now lives in the shared server core `src/lib/server/catalog-snapshot.ts`
 * (imported via the relative `.js` path — the `$lib` alias and `$env` virtual modules don't
 * resolve under tsx). The SAME core backs the deployed app's `/api/admin/publish-catalog`
 * endpoint, so a local reseed and a production publish stay in lockstep.
 *
 * The whole replay runs in one transaction; see the core for why.
 *
 *   pnpm tsx scripts/seed-food-data.ts --step import-jsonl
 *   pnpm tsx scripts/seed-food-data.ts --step import-jsonl --reset
 *
 * Counterpart: export-catalog-jsonl.ts (`--step export-jsonl`).
 */

import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { importCatalogSnapshot } from "../../src/lib/server/catalog-snapshot.js";

export async function importFromJsonl(
	prisma: PrismaClient,
	options: { reset?: boolean; inPath?: string } = {},
): Promise<void> {
	await importCatalogSnapshot(prisma, { ...options, log: (msg) => console.log(`  ${msg}`) });
}
