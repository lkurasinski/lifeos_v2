/**
 * Duck-typed Prisma error-code guards — checked by `code` so we needn't import the Prisma error
 * namespace from the generated client at every call site. Shared by the food + recipe write paths,
 * which catch the same constraint violations and surface them as 409/400 instead of a raw 500.
 */

/** P2002 — unique constraint failed (a `(source, sourceId)` / taxonomy-slug race lost). */
export function isUniqueConstraintError(err: unknown): boolean {
	return hasCode(err, "P2002");
}

/** P2003 — foreign key constraint failed (on a write path: an unknown `nutrientId` tag). */
export function isForeignKeyConstraintError(err: unknown): boolean {
	return hasCode(err, "P2003");
}

function hasCode(err: unknown, code: string): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		(err as { code: unknown }).code === code
	);
}
