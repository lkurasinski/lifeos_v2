import { json, error } from "@sveltejs/kit";
import { timingSafeEqual } from "node:crypto";
import { REINDEX_TOKEN } from "$env/static/private";
import { prisma } from "$lib/server/db";
import { meili } from "$lib/server/search";
import { reindexFoodProducts, reindexRecipes } from "$lib/server/reindex";
import type { RequestHandler } from "./$types";

/**
 * Rebuild BOTH Meilisearch indexes (food products + recipes) from THIS deployment's database.
 * Because it runs inside the app, it uses the app's own `prisma` + `meili` clients — i.e. the
 * internal Railway DB and Meili over the private network — so the indexes are always sourced
 * from the same DB the app reads, and the bulk read never leaves Railway (no egress). The sync
 * script calls this after pushing the DB; it's also the way to reindex after editing products
 * or recipes on the live app.
 *
 * Guarded by a shared secret (REINDEX_TOKEN), not a user session: it's an operator action and
 * must be callable from a script with no cookie. Disabled (503) until the token is set.
 */
function tokenMatches(provided: string): boolean {
	if (!REINDEX_TOKEN || !provided) return false;
	const a = Buffer.from(provided);
	const b = Buffer.from(REINDEX_TOKEN);
	// timingSafeEqual requires equal lengths; the length check itself is not secret.
	return a.length === b.length && timingSafeEqual(a, b);
}

export const POST: RequestHandler = async ({ request }) => {
	if (!REINDEX_TOKEN) {
		error(503, "reindex_disabled");
	}
	const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
	if (!tokenMatches(bearer)) {
		error(401, "Unauthorized");
	}

	// Sequential (not parallel): both share one Meili client and the seed step orders them the
	// same way; keeps the bulk load off a single index at a time.
	const log = (msg: string) => console.log(`[reindex] ${msg}`);
	const foods = await reindexFoodProducts(prisma, meili, log);
	const recipes = await reindexRecipes(prisma, meili, log);
	return json({ foods, recipes });
};
