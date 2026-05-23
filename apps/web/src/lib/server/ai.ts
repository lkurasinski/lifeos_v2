import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { OPENAI_API_KEY, ANTHROPIC_API_KEY } from "$env/static/private";

export const openai = createOpenAI({
	apiKey: OPENAI_API_KEY,
});

export const anthropic = createAnthropic({
	apiKey: ANTHROPIC_API_KEY,
});
