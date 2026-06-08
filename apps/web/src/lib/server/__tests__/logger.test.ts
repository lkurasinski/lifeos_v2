// @vitest-environment node
import { describe, it, expect } from "vitest";
import pino from "pino";
import { resolveLevel, REDACT_PATHS, reqIdMixin, baseOptions } from "../logger.js";
import { runWithContext } from "../request-context.js";

describe("resolveLevel", () => {
	it("uses LOG_LEVEL when set, regardless of NODE_ENV", () => {
		expect(resolveLevel({ LOG_LEVEL: "warn", NODE_ENV: "production" })).toBe("warn");
		expect(resolveLevel({ LOG_LEVEL: "trace", NODE_ENV: "development" })).toBe("trace");
	});

	it("defaults to info in production when LOG_LEVEL is unset", () => {
		expect(resolveLevel({ NODE_ENV: "production" })).toBe("info");
	});

	it("defaults to debug in non-prod when LOG_LEVEL is unset", () => {
		expect(resolveLevel({ NODE_ENV: "development" })).toBe("debug");
		expect(resolveLevel({ NODE_ENV: "test" })).toBe("debug");
		expect(resolveLevel({})).toBe("debug");
	});
});

describe("redaction", () => {
	it("masks secret-bearing fields to [Redacted] while keeping the rest", () => {
		const lines: Record<string, unknown>[] = [];
		const stream = { write: (s: string) => lines.push(JSON.parse(s)) };
		const log = pino({ ...baseOptions, level: "info" }, stream);

		log.info(
			{
				password: "hunter2",
				authorization: "Bearer abc",
				secret: "shh",
				nested: { token: "t0ken", keep: "visible" },
				keep: "visible",
			},
			"msg",
		);

		expect(lines).toHaveLength(1);
		const line = lines[0];
		expect(line.password).toBe("[Redacted]");
		expect(line.authorization).toBe("[Redacted]");
		expect(line.secret).toBe("[Redacted]");
		expect((line.nested as Record<string, unknown>).token).toBe("[Redacted]");
		expect((line.nested as Record<string, unknown>).keep).toBe("visible");
		expect(line.keep).toBe("visible");
	});

	it("declares the documented redact paths", () => {
		expect(REDACT_PATHS).toContain("password");
		expect(REDACT_PATHS).toContain("req.headers.authorization");
		expect(REDACT_PATHS).toContain('res.headers["set-cookie"]');
	});
});

describe("reqIdMixin", () => {
	it("emits reqId inside a request context", () => {
		const out = runWithContext({ reqId: "r1" }, () => reqIdMixin());
		expect(out).toEqual({ reqId: "r1" });
	});

	it("emits nothing outside a request context", () => {
		expect(reqIdMixin()).toEqual({});
	});

	it("stamps reqId onto log lines emitted within the context", () => {
		const lines: Record<string, unknown>[] = [];
		const stream = { write: (s: string) => lines.push(JSON.parse(s)) };
		const log = pino({ ...baseOptions, level: "info" }, stream);

		runWithContext({ reqId: "r2" }, () => log.info("hi"));
		log.info("bye");

		expect(lines[0].reqId).toBe("r2");
		expect(lines[1].reqId).toBeUndefined();
	});
});
