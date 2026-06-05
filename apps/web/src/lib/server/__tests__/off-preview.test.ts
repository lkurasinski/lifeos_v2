// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildNutrimentRows } from "../off.js";
import { isBarcodeQuery, offToDraft } from "../../food/schema.js";

// Pure coverage for the OFF preview endpoint's decision + mapping logic (no live
// services — the endpoint's I/O is exercised in the integration/manual pass).

describe("isBarcodeQuery (smart-input detection)", () => {
	it("treats 8–14 digit strings as barcodes", () => {
		expect(isBarcodeQuery("5901234567890")).toBe(true); // EAN-13
		expect(isBarcodeQuery("12345678")).toBe(true); // EAN-8 (lower bound)
		expect(isBarcodeQuery("12345678901234")).toBe(true); // 14 (upper bound)
	});

	it("ignores surrounding/inner whitespace before testing", () => {
		expect(isBarcodeQuery("  590 1234 567890 ")).toBe(true);
	});

	it("treats names and out-of-range digit strings as free-text search", () => {
		expect(isBarcodeQuery("tuńczyk w sosie własnym")).toBe(false);
		expect(isBarcodeQuery("1234567")).toBe(false); // 7 digits — too short
		expect(isBarcodeQuery("123456789012345")).toBe(false); // 15 digits — too long
		expect(isBarcodeQuery("590123456789a")).toBe(false); // not all digits
		expect(isBarcodeQuery("")).toBe(false);
	});
});

describe("preview mapping (buildNutrimentRows → offToDraft)", () => {
	const nutrientIdMap = new Map([
		["ENERC_KCAL", "id-kcal"],
		["PROCNT", "id-protein"],
		["NA", "id-sodium"],
		["NACL", "id-salt"],
	]);

	it("produces a canonical-unit OFF draft (salt/sodium ×1000 applied internally)", () => {
		const off = {
			code: "5901234567890",
			product_name: "Tuna in brine",
			product_name_pl: "Tuńczyk w sosie własnym",
			brands: "Graal",
			nutriments: { "energy-kcal_100g": 108, proteins_100g: 24, salt_100g: 0.9 },
		};
		const rows = buildNutrimentRows(off.nutriments, nutrientIdMap);
		const draft = offToDraft(off, rows);

		expect(draft.source).toBe("OFF");
		expect(draft.sourceId).toBe("5901234567890");
		expect(draft.nameEn).toBe("Tuna in brine");
		expect(draft.namePl).toBe("Tuńczyk w sosie własnym");
		expect(draft.brand).toBe("Graal");
		// salt 0.9 g → 900 mg (canonical), no raw value leaks through.
		const salt = draft.nutrients.find((n) => n.nutrientId === "id-salt");
		expect(salt?.amountPer100g).toBeCloseTo(900);
		// sodium absent from OFF → absent from the draft (NULL, never 0).
		expect(draft.nutrients.some((n) => n.nutrientId === "id-sodium")).toBe(false);
	});

	it("yields an all-null (empty) draft when the OFF product reports no nutriments", () => {
		// No nutriments → the endpoint passes an empty row set; the draft carries no values.
		const draft = offToDraft({ code: "0000000000000", product_name: "Mystery" }, []);
		expect(draft.nutrients).toEqual([]);
		expect(draft.nameEn).toBe("Mystery");
	});
});
