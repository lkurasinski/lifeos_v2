/**
 * Step: index
 *
 * Configure the food_products Meilisearch index and bulk-index all FoodProduct rows.
 *
 * The reindex logic now lives in the shared server core `src/lib/server/reindex.ts`
 * (imported via the relative `.js` path — the `$lib` alias and `$env` virtual modules
 * don't resolve under tsx). The SAME core backs the deployed app's `/api/admin/reindex`
 * endpoint, so the batch step and the on-Railway reindex stay in lockstep.
 */
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { Meilisearch } from "meilisearch";
import { reindexFoodProducts } from "../../src/lib/server/reindex.js";

export async function indexMeilisearch(prisma: PrismaClient, meili: Meilisearch) {
	await reindexFoodProducts(prisma, meili, (msg) => console.log(msg));
}
