import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
	plugins: [svelte()],
	// Resolve the `browser` entry points even though Vitest runs in Node, so the Svelte
	// client runtime (where `$effect` actually runs) is used instead of the SSR build.
	// Without this, runes effects are no-ops and `*.svelte.test.ts` timing tests can't fire.
	resolve: { conditions: ["browser"] },
	test: {
		environment: "jsdom",
		include: ["src/**/*.test.ts"],
		setupFiles: ["src/tests/setup.ts"],
		alias: {
			$lib: new URL("./src/lib", import.meta.url).pathname,
			"$app/environment": new URL("./src/tests/mocks/app-environment.ts", import.meta.url).pathname,
			"$app/navigation": new URL("./src/tests/mocks/app-navigation.ts", import.meta.url).pathname,
			"$env/static/private": new URL("./src/tests/mocks/env-private.ts", import.meta.url).pathname,
			"$env/static/public": new URL("./src/tests/mocks/env-public.ts", import.meta.url).pathname,
		},
	},
});
