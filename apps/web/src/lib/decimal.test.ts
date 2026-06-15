import { describe, it, expect } from "vitest";
import { parseDecimalPl, formatDecimalPl } from "./decimal";

describe("parseDecimalPl", () => {
	it("accepts comma and dot decimals", () => {
		expect(parseDecimalPl("1,5")).toBe(1.5);
		expect(parseDecimalPl("1.5")).toBe(1.5);
		expect(parseDecimalPl("  2,25  ")).toBe(2.25);
	});

	it("passes finite numbers through and keeps a typed 0", () => {
		expect(parseDecimalPl(5)).toBe(5);
		expect(parseDecimalPl(0)).toBe(0);
		expect(parseDecimalPl("0")).toBe(0);
	});

	it("treats empty/blank/null/undefined as null (NULL ≠ 0)", () => {
		expect(parseDecimalPl("")).toBeNull();
		expect(parseDecimalPl("   ")).toBeNull();
		expect(parseDecimalPl(null)).toBeNull();
		expect(parseDecimalPl(undefined)).toBeNull();
	});

	it("rejects non-finite and non-numeric strings", () => {
		expect(parseDecimalPl("abc")).toBeNull();
		expect(parseDecimalPl(Infinity)).toBeNull();
		expect(parseDecimalPl(NaN)).toBeNull();
	});

	it("returns null (never throws) for untrusted non-string/number input", () => {
		// The amountSchema preprocess feeds this raw request values — a boolean/object must not
		// throw (it would 500 instead of letting Zod reject with a 400).
		expect(parseDecimalPl(true)).toBeNull();
		expect(parseDecimalPl({})).toBeNull();
		expect(parseDecimalPl([])).toBeNull();
	});

	it("does NOT impose a sign guard (callers add their own)", () => {
		expect(parseDecimalPl("-5")).toBe(-5);
		expect(parseDecimalPl(-2.5)).toBe(-2.5);
	});
});

describe("formatDecimalPl", () => {
	it("renders a dot decimal as a pl-PL comma", () => {
		expect(formatDecimalPl(1.5)).toBe("1,5");
		expect(formatDecimalPl(250)).toBe("250");
	});

	it("round-trips through parseDecimalPl unchanged", () => {
		for (const n of [0, 5, 1.5, 250, 0.25]) {
			expect(parseDecimalPl(formatDecimalPl(n))).toBe(n);
		}
	});
});
