import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
	plugins: [svelte()],
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
