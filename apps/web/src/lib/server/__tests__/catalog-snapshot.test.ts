// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { importCatalogSnapshot } from "../catalog-snapshot";
import type { PrismaClient } from "../../../generated/prisma/client";

/**
 * Guards the reset path — the only code here that deletes rows, and the one that runs against
 * production. The expected outcomes are derived from the ownership rule (the repo owns USDA
 * rows, a database owns what was created inside it), never from what the implementation happens
 * to do.
 */

// ─── Snapshot fixture ─────────────────────────────────────────────────────────────

const IN_SNAPSHOT = "11111111-1111-1111-1111-111111111111";
let dir: string;
let snapshotPath: string;

beforeAll(() => {
	dir = mkdtempSync(path.join(tmpdir(), "catalog-snapshot-"));
	snapshotPath = path.join(dir, "catalog.jsonl");
	writeFileSync(
		snapshotPath,
		[
			JSON.stringify({
				kind: "category",
				id: "cat-1",
				slug: "vegetables",
				namePl: "Warzywa",
				nameEn: "Vegetables",
			}),
			JSON.stringify({
				kind: "product",
				id: IN_SNAPSHOT,
				source: "USDA_SR",
				sourceId: "11111",
				nameEn: "Carrots, raw",
				namePl: "Marchew, surowa",
				brand: null,
				categoryId: "cat-1",
				sourceCategory: "11",
				servingSizeG: null,
				densityGPerMl: null,
				pieceWeightG: null,
				userModified: false,
				imageUrl: null,
				imageThumbUrl: null,
				imageIngredientsUrl: null,
				imageNutritionUrl: null,
				nutrients: [{ nutrientId: "ENERC_KCAL", amountPer100g: "41" }],
			}),
		].join("\n") + "\n",
	);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

// ─── Prisma double ────────────────────────────────────────────────────────────────

type Extra = { id: string; sourceId: string; nameEn: string; source: string };

/** `extras` are rows the database holds that the snapshot does not; `referenced` are in use. */
function makePrisma(extras: Extra[], referenced: string[] = []) {
	const inSnapshot = {
		id: IN_SNAPSHOT,
		sourceId: "11111",
		nameEn: "Carrots, raw",
		source: "USDA_SR",
	};
	const prisma = {
		foodCategory: { upsert: vi.fn().mockResolvedValue({}) },
		foodProduct: {
			upsert: vi.fn().mockResolvedValue({}),
			findMany: vi.fn().mockResolvedValue([inSnapshot, ...extras]),
			deleteMany: vi
				.fn()
				.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
					Promise.resolve({ count: where.id.in.length }),
				),
		},
		foodNutrient: {
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			createMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		recipeComponent: {
			findMany: vi.fn().mockResolvedValue(referenced.map((productId) => ({ productId }))),
		},
		$transaction: vi.fn(),
	};
	prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => unknown) => cb(prisma));
	return prisma;
}

/** The ids a run actually asked Postgres to delete. */
function deletedIds(prisma: ReturnType<typeof makePrisma>): string[] {
	const call = prisma.foodProduct.deleteMany.mock.calls.at(-1);
	return call ? call[0].where.id.in : [];
}

const run = (prisma: ReturnType<typeof makePrisma>, opts: { reset?: boolean; force?: boolean }) =>
	importCatalogSnapshot(prisma as unknown as PrismaClient, { ...opts, inPath: snapshotPath });

const usda = { id: "usda-extra", sourceId: "99999", nameEn: "Stale USDA row", source: "USDA_SR" };
const off = { id: "off-extra", sourceId: "590000", nameEn: "Skyr", source: "OFF" };
const custom = { id: "custom-extra", sourceId: "c-1", nameEn: "Babcia's jam", source: "CUSTOM" };

// ─── Without reset, nothing is ever deleted ───────────────────────────────────────

describe("importCatalogSnapshot without reset", () => {
	it("leaves extra products alone entirely", async () => {
		const prisma = makePrisma([usda, off]);
		const result = await run(prisma, {});
		expect(prisma.foodProduct.deleteMany).not.toHaveBeenCalled();
		expect(result.deleted).toBe(0);
		expect(result.skipped).toEqual([]);
	});
});

// ─── Reset: repo-owned rows go, database-owned rows stay ──────────────────────────

describe("importCatalogSnapshot with reset", () => {
	it("deletes a stale USDA row — the repo owns it and the snapshot can replay it", async () => {
		const prisma = makePrisma([usda]);
		const result = await run(prisma, { reset: true });
		expect(deletedIds(prisma)).toEqual(["usda-extra"]);
		expect(result.deleted).toBe(1);
		expect(result.skipped).toEqual([]);
	});

	it("keeps OFF and CUSTOM rows — they exist in no other place", async () => {
		const prisma = makePrisma([usda, off, custom]);
		const result = await run(prisma, { reset: true });

		expect(deletedIds(prisma)).toEqual(["usda-extra"]);
		expect(result.deleted).toBe(1);
		expect(result.skipped).toEqual([
			{ sourceId: "590000", nameEn: "Skyr", reason: "user-created" },
			{ sourceId: "c-1", nameEn: "Babcia's jam", reason: "user-created" },
		]);
	});

	it("never deletes a product a recipe still references", async () => {
		const prisma = makePrisma([usda], [usda.id]);
		const result = await run(prisma, { reset: true });

		expect(prisma.foodProduct.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [] } } });
		expect(result.deleted).toBe(0);
		expect(result.skipped).toEqual([
			{ sourceId: "99999", nameEn: "Stale USDA row", reason: "recipe-reference" },
		]);
	});

	it("keeps a product in the snapshot even when the database also holds it", async () => {
		const prisma = makePrisma([usda]);
		await run(prisma, { reset: true });
		expect(deletedIds(prisma)).not.toContain(IN_SNAPSHOT);
	});
});

// ─── force is the explicit override, and only for user-created rows ───────────────

describe("importCatalogSnapshot with reset + force", () => {
	it("deletes app-created rows once asked explicitly", async () => {
		const prisma = makePrisma([usda, off, custom]);
		const result = await run(prisma, { reset: true, force: true });

		expect(deletedIds(prisma).sort()).toEqual(["custom-extra", "off-extra", "usda-extra"]);
		expect(result.deleted).toBe(3);
		expect(result.skipped).toEqual([]);
	});

	it("still refuses to delete a referenced product — force does not override integrity", async () => {
		const prisma = makePrisma([off], [off.id]);
		const result = await run(prisma, { reset: true, force: true });

		expect(deletedIds(prisma)).toEqual([]);
		expect(result.skipped).toEqual([
			{ sourceId: "590000", nameEn: "Skyr", reason: "recipe-reference" },
		]);
	});
});
