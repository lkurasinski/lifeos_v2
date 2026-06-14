/**
 * Shared runtime Meilisearch sync plumbing for the food + recipe write paths.
 *
 * These three concerns were copy-pasted verbatim between `food-products.ts` and `recipes.ts`
 * (the files even noted they "mirror" each other); centralizing them keeps the two index-sync
 * layers from drifting. Server-only — binds the `meili` singleton from `search.ts`.
 *
 * NOTE: the tsx batch reindex (`reindex.ts`) keeps its OWN `waitForMeiliTask(meili, taskUid)`
 * on purpose — it takes the client as an argument so it imports neither `$lib/server/search`
 * nor `$env/*` and stays loadable under tsx. That decoupling is worth the one duplicated helper.
 */
import type { Settings } from "meilisearch";
import { meili } from "$lib/server/search";
import { logger } from "$lib/server/logger";
import { memoizeAsync } from "$lib/server/memoize";

/**
 * Await a Meili task and throw if it ended `failed`. `waitForTask` resolves on ANY terminal
 * status (succeeded OR failed), so without this check a task Meili rejected (bad doc, settings
 * mismatch) would look like success.
 */
export async function waitForMeiliTask(taskUid: number): Promise<void> {
	const task = await meili.tasks.waitForTask(taskUid);
	if (task.status === "failed") {
		throw new Error(`Meili task ${taskUid} failed: ${task.error?.message ?? "unknown error"}`);
	}
}

/**
 * Run a Meili sync side-effect AFTER a committed DB write. The DB row is authoritative, so an
 * index failure must never mask a successful write: log it (the recoverable-drift signal) and
 * swallow. `recoveryHint` names the reconvergence path for that domain (e.g. "recover via
 * recipe:reindex"); it's appended to the shared message. The index reconverges on the next
 * mutation or a reindex.
 */
export async function syncAfterCommit(
	op: () => Promise<void>,
	id: string,
	recoveryHint: string,
): Promise<void> {
	try {
		await op();
	} catch (err) {
		logger.error({ err, id }, `Meili sync failed after committed DB write — ${recoveryHint}`);
	}
}

export interface IndexConfigurer {
	/** Apply the index settings to the runtime singleton index. Idempotent. */
	configure(): Promise<void>;
	/**
	 * Apply the settings ONCE per process before the first live `addDocuments` (memoized; retries
	 * on failure). `addDocuments` auto-creates a bare index — empty filterable/sortable attributes
	 * — on a fresh environment where the batch reindex hasn't run; a later faceted/sorted/filtered
	 * search would then throw. (Lessons: "settings before first use".)
	 */
	ensureConfigured(): Promise<void>;
}

/**
 * Build the configure / ensure-configured pair for a runtime index from its shared settings
 * constant. `ensureConfigured` is memoized per configurer (one `updateSettings` per process).
 */
export function makeIndexConfigurer(indexName: string, settings: Settings): IndexConfigurer {
	const configure = async (): Promise<void> => {
		const index = meili.index(indexName);
		const task = await index.updateSettings(settings);
		await waitForMeiliTask(task.taskUid);
	};
	return { configure, ensureConfigured: memoizeAsync(configure) };
}
