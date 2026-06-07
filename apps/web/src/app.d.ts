import type { auth } from "$lib/server/auth";

declare global {
	namespace App {
		interface Locals {
			session: typeof auth.$Infer.Session.session | null;
			user: typeof auth.$Infer.Session.user | null;
		}
		interface PageState {
			/** Shallow-routing flag for the catalog detail modal: the shown product id. */
			detailId?: string;
		}
	}
}

export {};
