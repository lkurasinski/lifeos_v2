/**
 * Shared HTTP-boundary helpers for the JSON API routes (and the auth-gated page loads).
 *
 * The domain services throw SEMANTIC errors (`RecipeNotFoundError`, `FoodProductInUseError`,
 * …); deciding which HTTP status + body each maps to is a TRANSPORT concern, so it lives here
 * at the boundary rather than in the domain error classes or copy-pasted into every endpoint.
 * Keeping the three controller chores — auth gate, body validation, error→response mapping —
 * in one place means a new status policy (or a new error class) is wired once, not in N routes.
 *
 * Server-only (pulls in the Prisma/Meili-backed service modules via the error-class imports).
 */
import { error, json } from "@sveltejs/kit";
import type { z } from "zod";
import {
	RecipeNotFoundError,
	RecipeForbiddenError,
	RecipeInUseError,
	RecipeCycleError,
	RecipeDepthError,
} from "$lib/server/recipes";
import {
	FoodProductNotFoundError,
	FoodProductConflictError,
	FoodProductInUseError,
	UnknownNutrientError,
} from "$lib/server/food-products";
import { OFFError } from "$lib/server/off";

// ─── Auth gate ──────────────────────────────────────────────────────────────────

/**
 * Require an authenticated user, returning the narrowed (non-null) user. Throws 401 when
 * either the session or the user is absent — the single auth shape for every protected
 * endpoint (some routes previously checked `!session`, others `!session || !user`; this
 * unifies on requiring both, the strictly-safer gate). The `(app)` layout already redirects
 * anonymous browser navigations to `/login`; this guards the `/api/**` JSON routes (and the
 * loads that need the viewer id) where a thrown 401 is the right answer.
 */
export function requireUser(locals: App.Locals): NonNullable<App.Locals["user"]> {
	if (!locals.session || !locals.user) {
		error(401, "Unauthorized");
	}
	return locals.user;
}

/** Require an authenticated user and return just their id (the common case). */
export function requireUserId(locals: App.Locals): string {
	return requireUser(locals).id;
}

// ─── Input validation ─────────────────────────────────────────────────────────────

/**
 * Parse + validate a JSON request body against a Zod schema, throwing 400 (with the given
 * Polish message) on malformed JSON or a schema mismatch. The `await request.json()` is
 * inside the guard, so a non-JSON body 400s too rather than 500ing.
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
	request: Request,
	schema: S,
	message: string,
): Promise<z.infer<S>> {
	try {
		return schema.parse(await request.json());
	} catch {
		error(400, message);
	}
}

/**
 * Run a synchronous parse (e.g. `parseSearchParams(url.searchParams)`) and convert a thrown
 * validation error into a 400 with the given message. Used by the search GET endpoints, where
 * a bad enum is a real client error to surface — unlike the SSR page loads, which let the
 * parse throw into SvelteKit's error rendering.
 */
export function parseOr400<T>(parse: () => T, message: string): T {
	try {
		return parse();
	} catch {
		error(400, message);
	}
}

// ─── Error → response mapping ──────────────────────────────────────────────────────

/**
 * Map a typed service error to its HTTP response. Two response styles, by intent:
 *
 *  - PLAIN errors (`error(status, msg)`, thrown → SvelteKit renders them): not-found,
 *    forbidden, bad-input, upstream-unavailable. The message is the user-facing text.
 *  - STRUCTURED 409s (`json({ error: code, … }, { status: 409 })`, returned): the client
 *    parses the body to drive its own UX (route to the conflicting id, surface the cycle/
 *    depth reason, list the referencing recipes). The shape is part of the API contract.
 *
 * Each error class hardcodes its own domain copy (recipe vs. product), so the right message
 * follows from the class alone. Unknown errors are re-thrown to become a genuine 500.
 *
 * Call as the sole body of a route catch: `catch (err) { return mapServiceError(err); }` —
 * the plain-error branches throw (so the `return` is never reached), the structured branches
 * return the `Response`.
 */
export function mapServiceError(err: unknown): Response {
	// Plain HTTP errors (thrown, rendered by SvelteKit).
	if (err instanceof RecipeNotFoundError) error(404, "Nie znaleziono przepisu");
	if (err instanceof RecipeForbiddenError) error(403, "Brak uprawnień do tego przepisu");
	if (err instanceof FoodProductNotFoundError) error(404, "Nie znaleziono produktu");
	if (err instanceof UnknownNutrientError) error(400, "Nieprawidłowy składnik odżywczy");
	if (err instanceof OFFError) {
		error(
			err.status === 429 ? 429 : 502,
			err.status === 429 ? "off_rate_limited" : "off_unavailable",
		);
	}

	// Structured 409s (returned; the client parses the JSON body).
	if (err instanceof RecipeCycleError) {
		return json({ error: "cycle" }, { status: 409 });
	}
	if (err instanceof RecipeDepthError) {
		return json({ error: "depth", max: err.max }, { status: 409 });
	}
	if (err instanceof RecipeInUseError) {
		return json({ error: "in_use", referencingIds: err.referencingIds }, { status: 409 });
	}
	if (err instanceof FoodProductConflictError) {
		return json({ error: "conflict", existingId: err.existingId }, { status: 409 });
	}
	if (err instanceof FoodProductInUseError) {
		return json({ error: "in_use", referencingIds: err.referencingRecipeIds }, { status: 409 });
	}

	throw err;
}
