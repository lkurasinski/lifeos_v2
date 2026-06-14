/**
 * Step: recipe-index
 *
 * Configure the recipes Meilisearch index and bulk-index all PUBLISHED Recipe rows.
 *
 * The reindex logic lives in the shared server core `src/lib/server/reindex.ts` (imported via
 * the relative `.js` path — the `$lib` alias and `$env` virtual modules don't resolve under
 * tsx). The SAME core's pure document builder backs the deployed app's runtime sync, so the
 * batch step and the live `syncRecipeDocument` stay in lockstep.
 */
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { Meilisearch } from "meilisearch";
import { reindexRecipes } from "../../src/lib/server/reindex.js";

export async function indexRecipes(prisma: PrismaClient, meili: Meilisearch) {
	await reindexRecipes(prisma, meili, (msg) => console.log(msg));
}
