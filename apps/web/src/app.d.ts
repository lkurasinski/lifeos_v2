import type { auth } from "$lib/server/auth";

declare global {
	namespace App {
		interface Error {
			message: string;
			/** Correlation id (the request's `reqId`) surfaced to the client by `handleError`. */
			errorId?: string;
		}
		interface Locals {
			session: typeof auth.$Infer.Session.session | null;
			user: typeof auth.$Infer.Session.user | null;
		}
		interface PageState {
			/** Shallow-routing flag for the catalog detail modal: the shown product id. */
			detailId?: string;
			/** Shallow-routing flag for the recipe detail modal: the shown recipe id. */
			recipeDetailId?: string;
		}
	}
}

export {};
