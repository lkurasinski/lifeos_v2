import { z } from "zod";
import * as privateEnv from "$env/static/private";

const envSchema = z.object({
	DATABASE_URL: z.string().nonempty(),
	BETTER_AUTH_SECRET: z.string().nonempty(),
	BETTER_AUTH_URL: z.string().nonempty(),
	RESEND_API_KEY: z.string().nonempty(),
	OPENAI_API_KEY: z.string().optional().default(""),
	ANTHROPIC_API_KEY: z.string().optional().default(""),
	MEILISEARCH_HOST: z.string().nonempty(),
	MEILISEARCH_API_KEY: z.string().nonempty(),
});

export function validateEnv() {
	const result = envSchema.safeParse(privateEnv);
	if (!result.success) {
		const formatted = result.error.issues
			.map((i) => `  ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		throw new Error(`Missing or invalid environment variables:\n${formatted}`);
	}
}
