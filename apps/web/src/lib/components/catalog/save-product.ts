import type { PatchPayload, SavePayload } from "$lib/food/schema";

/**
 * Outcome of a create/edit save request, decoupled from HTTP status and UI copy so
 * each page maps it to its own toast + navigation:
 * - `ok`      — persisted (2xx)
 * - `special` — the route's expected non-error status (create: 409 already-saved;
 *               edit: 404 vanished) — the caller toasts + navigates rather than retrying
 * - `error`   — anything else (incl. network failure) — the caller stays on the form
 */
export type SaveOutcome = "ok" | "special" | "error";

/**
 * POST/PATCH a product payload and reduce the response to a `SaveOutcome`. The
 * fetch/JSON/try-catch boilerplate lives here once; the create (`/foods/new`) and edit
 * (`/foods/[id]/edit`) pages share it and own only their copy + navigation. `specialStatus`
 * is the route's expected non-error code (409 for create, 404 for edit).
 */
export async function saveDraft(
	url: string,
	method: "POST" | "PATCH",
	payload: SavePayload | PatchPayload,
	specialStatus: number,
): Promise<SaveOutcome> {
	try {
		const res = await fetch(url, {
			method,
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (res.status === specialStatus) return "special";
		if (!res.ok) return "error";
		return "ok";
	} catch {
		return "error";
	}
}

/** Display name for save toasts: Polish name when present, else the English name. */
export function draftDisplayName(d: { namePl?: string | null; nameEn: string }): string {
	return d.namePl?.trim() || d.nameEn;
}
