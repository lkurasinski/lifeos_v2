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
				"img-src": ["self", "data:"],
				"font-src": ["self"],
				"connect-src": ["self"],
				"frame-ancestors": ["none"],
				"default-src": ["self"],
			},
		},
	},
};

export default config;
