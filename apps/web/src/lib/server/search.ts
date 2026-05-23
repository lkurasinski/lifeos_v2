import { Meilisearch } from "meilisearch";
import { MEILISEARCH_HOST, MEILISEARCH_API_KEY } from "$env/static/private";

export const meili = new Meilisearch({
	host: MEILISEARCH_HOST,
	apiKey: MEILISEARCH_API_KEY,
});
