import { json, error } from "@sveltejs/kit";
import { timingSafeEqual } from "node:crypto";
import { REINDEX_TOKEN } from "$env/static/private";
import { prisma } from "$lib/server/db";
import { meili } from "$lib/server/search";
import { importCatalogSnapshot, resolveSnapshotPath } from "$lib/server/catalog-snapshot";
import { reindexFoodProducts } from "$lib/server/reindex";
import type { RequestHandler } from "./$types";

/**
 * Publish the catalog into THIS deployment's database from the snapshot shipped in its own
 * build, then rebuild the food index.
 *
 * The catalog is repo-owned (`apps/web/data/catalog-seed/catalog.jsonl`), so publishing is a
 * deployment acting on its own data — not an operator's laptop writing across the internet.
 * Running it here means: no production database credential outside Railway, no public Postgres
 * proxy (~37ms per statement becomes the private network), and data that always matches the
 * code of the same commit. `scripts/db-sync.sh publish` is the client for this endpoint and
 * takes the backup before calling it.
 *
 * The replay is one transaction (see `$lib/server/catalog-snapshot`): a publish either lands
 * completely or not at all. Reindexing follows the commit — a failed index task leaves a
 * recoverable database and `/api/admin/reindex` picks it up.
 *
 * Guarded by the same operator secret as `/api/admin/reindex`: both are script-invoked
 * maintenance actions with no cookie, and splitting the token would only mean two secrets to
 * rotate for one trust level. Disabled (503) until the token is set.
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
		error(503, "publish_disabled");
	}
	const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
	if (!tokenMatches(bearer)) {
		error(401, "Unauthorized");
	}

	// `reset` makes the catalog match the snapshot 1:1, deleting products absent from it —
	// including anything added through this deployment. Opt-in, never the default.
	let reset = false;
	const raw = await request.text();
	if (raw.trim()) {
		try {
			const body = JSON.parse(raw) as { reset?: unknown };
			reset = body.reset === true;
		} catch {
			error(400, "invalid_json");
		}
	}

	const log = (msg: string) => console.log(`[publish-catalog] ${msg}`);

	let snapshot: string;
	try {
		snapshot = resolveSnapshotPath();
	} catch (e) {
		// A deployment without its snapshot cannot publish; say so plainly rather than 500.
		log(String(e));
		error(503, "snapshot_missing");
	}

	const result = await importCatalogSnapshot(prisma, { reset, inPath: snapshot, log });
	const indexed = await reindexFoodProducts(prisma, meili, log);

	return json({ ...result, indexed, snapshot });
};
