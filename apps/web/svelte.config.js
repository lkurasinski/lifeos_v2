import adapter from "@sveltejs/adapter-node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
	},
	kit: {
		adapter: adapter(),
		csp: {
			directives: {
				"script-src": ["self"],
				"style-src": ["self", "unsafe-inline"],
				// OFF product photos: images.openfoodfacts.org is the current CDN, but OFF
				// has also served static./world. hosts — allow any openfoodfacts.org
				// subdomain (matches the *.openfoodfacts.org host check in savePayloadSchema).
				"img-src": ["self", "data:", "https://*.openfoodfacts.org"],
				"font-src": ["self"],
				"connect-src": ["self"],
				"frame-ancestors": ["none"],
				"default-src": ["self"],
			},
		},
	},
};

export default config;
