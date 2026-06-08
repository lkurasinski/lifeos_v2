// @vitest-environment node
import { describe, it, expect } from "vitest";
import pino from "pino";
import { baseOptions } from "../logger.js";
import { runWithContext } from "../request-context.js";

describe("request context propagation", () => {
	it("propagates reqId to logs across nested async boundaries, and omits it outside", async () => {
		const lines: Record<string, unknown>[] = [];
		const stream = { write: (s: string) => lines.push(JSON.parse(s)) };
		const log = pino({ ...baseOptions, level: "info" }, stream);

		async function nested() {
			await Promise.resolve();
			log.info("from nested");
		}

		await runWithContext({ reqId: "r1" }, async () => {
			log.info("from top");
			await nested();
		});

		log.info("outside");

		expect(lines[0].reqId).toBe("r1"); // top-level call inside the context
		expect(lines[1].reqId).toBe("r1"); // nested async call still sees the context
		expect(lines[2].reqId).toBeUndefined(); // call after the context closed
	});
});
