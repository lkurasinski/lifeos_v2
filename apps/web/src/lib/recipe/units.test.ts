// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveGrams, type UnitConversion } from "./units.js";

const g: UnitConversion = { kind: "MASS", baseFactor: 1 };
const dag: UnitConversion = { kind: "MASS", baseFactor: 10 };
const kg: UnitConversion = { kind: "MASS", baseFactor: 1000 };
const ml: UnitConversion = { kind: "VOLUME", baseFactor: 1 };
const tbsp: UnitConversion = { kind: "VOLUME", baseFactor: 15 };
const cup: UnitConversion = { kind: "VOLUME", baseFactor: 250 };
const piece: UnitConversion = { kind: "COUNT", baseFactor: 0 };

describe("resolveGrams — MASS", () => {
	it("converts by the global factor, ignoring product conversion data", () => {
		expect(resolveGrams(200, g, {})).toBe(200);
		expect(resolveGrams(3, dag, {})).toBe(30);
		expect(resolveGrams(1.5, kg, {})).toBe(1500);
	});
});

describe("resolveGrams — VOLUME", () => {
	it("treats null/absent density as water (1.0)", () => {
		expect(resolveGrams(100, ml, {})).toBe(100);
		expect(resolveGrams(1, tbsp, { densityGPerMl: null })).toBe(15);
	});

	it("applies the product density to the ml volume", () => {
		// 1 tbsp = 15 ml; olive oil ≈ 0.92 g/ml → 13.8 g
		expect(resolveGrams(1, tbsp, { densityGPerMl: 0.92 })).toBeCloseTo(13.8, 6);
		// 1 cup = 250 ml of honey ≈ 1.42 g/ml → 355 g
		expect(resolveGrams(1, cup, { densityGPerMl: 1.42 })).toBeCloseTo(355, 6);
	});
});

describe("resolveGrams — COUNT", () => {
	it("converts via pieceWeightG when present", () => {
		expect(resolveGrams(2, piece, { pieceWeightG: 60 })).toBe(120);
		expect(resolveGrams(3, piece, { pieceWeightG: 5 })).toBe(15); // ząbek czosnku
	});

	it("returns null (UNRESOLVED) when pieceWeightG is missing — never zeroed", () => {
		expect(resolveGrams(2, piece, {})).toBeNull();
		expect(resolveGrams(2, piece, { pieceWeightG: null })).toBeNull();
		// Density present but irrelevant for COUNT — still unresolved without piece-weight.
		expect(resolveGrams(2, piece, { densityGPerMl: 1 })).toBeNull();
	});
});

describe("resolveGrams — bad input is unresolved, never a wrong number", () => {
	it("rejects negative amounts across kinds (would corrupt totals/yield)", () => {
		expect(resolveGrams(-100, g, {})).toBeNull();
		expect(resolveGrams(-1, tbsp, { densityGPerMl: 0.92 })).toBeNull();
		expect(resolveGrams(-2, piece, { pieceWeightG: 60 })).toBeNull();
	});

	it("rejects NaN / Infinity amounts and factors", () => {
		expect(resolveGrams(NaN, g, {})).toBeNull();
		expect(resolveGrams(Infinity, g, {})).toBeNull();
		expect(resolveGrams(5, { kind: "MASS", baseFactor: NaN }, {})).toBeNull();
		expect(resolveGrams(5, tbsp, { densityGPerMl: Infinity })).toBeNull();
	});

	it("keeps a legitimate 0 as a resolved weight", () => {
		expect(resolveGrams(0, g, {})).toBe(0);
		expect(resolveGrams(0, piece, { pieceWeightG: 60 })).toBe(0);
	});
});
