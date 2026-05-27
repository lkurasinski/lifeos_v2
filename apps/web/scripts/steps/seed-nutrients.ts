/**
 * Step: nutrients
 *
 * 1. Parse INFOODS tagnames CSV from @nodef/infoods package
 * 2. Filter to BASE nutrients (per-100g units)
 * 3. Upsert into Nutrient table with USDA ID mapping if available
 * 4. AI batch translate name_en → name_pl using Anthropic Haiku
 *
 * USDA nutrient.csv is optional: place at data/usda/foundation/nutrient.csv
 * Download from https://fdc.nal.usda.gov/download-datasets (Foundation Foods zip)
 */

import path from 'path';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { PrismaClient, NutrientCategory } from '../../src/generated/prisma/client.js';
import type { createAnthropic } from '@ai-sdk/anthropic';

const _require = createRequire(import.meta.url);

function resolveInfoodsCsvPath(): string {
	const pkgMain = _require.resolve('@nodef/infoods');
	return path.join(path.dirname(pkgMain), 'tagnames', 'index.csv');
}

// Units that indicate per-100g measurements (BASE nutrients per INFOODS spec)
const BASE_UNIT_SET = new Set([
	'g',
	'mg',
	'µg',
	'mcg',
	'%',
	'kJ',
	'kcal',
	'mcg DFE',
	'µg DFE',
	'mg NE',
	'mg RE',
	'µg RAE',
	'mcg RAE',
]);

export function isBaseUnit(unit: string): boolean {
	if (!unit.trim()) return false;
	// Unit field may contain multiple units separated by "; "
	return unit
		.split(';')
		.map((p) => p.trim().replace(/\s+/g, ' ').replace(/\bmcg\b/g, 'µg'))
		.some((p) => BASE_UNIT_SET.has(p));
}

export function normalizeUnit(unit: string): string {
	return unit
		.split(';')[0]
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/\bmcg\b/g, 'µg');
}

// Proximate total-fat variants (not individual fatty acids)
const PROXIMATE_FAT_EXACT = new Set([
	'FAT',
	'FAT-',
	'FATAN',
	'FATCAN',
	'FATCE',
	'FATCPL',
	'FATPL',
	'FATNLEA',
]);

export function classifyNutrient(tagname: string): NutrientCategory {
	if (tagname.startsWith('ENERC')) return 'ENERGY';

	// Carotenoids before vitamins — beta-carotene has entries in both
	if (/^(CARTA|CARTB|CRYPX|LYCO|LUTN|ZEA)/.test(tagname)) return 'CAROTENOID';

	// Vitamins
	if (
		tagname.startsWith('VIT') ||
		/^(BIOT|PANTAC|NIAC|RIBF|THIA|CHOLN|FOLAC|FOL|NIAO)/.test(tagname)
	)
		return 'VITAMIN';

	// Amino acids — exact code or code followed by a non-uppercase char (e.g. ALA_T)
	if (
		/^(ALA|ARG|ASN|ASP|CYS|CYSTE|GLN|GLU|GLY|HIS|HYP|ILE|LEU|LYS|MET|PHE|PRO|SER|THR|TRP|TYR|VAL|XANTH)($|[^A-Z])/.test(
			tagname
		)
	)
		return 'AMINO_ACID';

	// Proximate: carbohydrates, fibre, starch, sugar, water, ash, alcohol, and total fat
	if (
		PROXIMATE_FAT_EXACT.has(tagname) ||
		/^(PROCNT|PROTCNT|WATER|ASH|ALCO|FIBT|FIBSOL|FIBINS|FIBAD|FIBCC|FIBCE|FIBDF|CHOCDF|CHOAVL|CHOAVDF|CHONDF|SUGAR|SUGR|STARCH|STAR)/.test(
			tagname
		)
	)
		return 'PROXIMATE';

	// Lipids: individual fatty acids (FA* excl. FAT*, F<digit>*), cholesterol, sterols
	if (
		tagname.startsWith('FA') ||
		/^F[0-9]/.test(tagname) ||
		tagname === 'CHOL' ||
		tagname.startsWith('PHYTSTR') ||
		tagname.startsWith('SITSTR')
	)
		return 'LIPID';

	// Minerals: single/two-letter chemical element symbols
	if (
		/^(CA|FE|MG|P|K|NA|ZN|CU|MN|SE|CR|MO|I|F|CL|B|NI|SN|SI|V|AS|HG|PB|AL|CD|BA|LI|SR|RB)$/.test(
			tagname
		)
	)
		return 'MINERAL';

	return 'OTHER';
}

interface InfoodsRow {
	code: string;
	name: string;
	unit: string;
}

interface UsdaNutrientRow {
	id: string;
	name: string;
	unit_name: string;
	nutrient_nbr: string;
	rank: string;
	tagname: string;
}

function readInfoodsRows(): InfoodsRow[] {
	const csvPath = resolveInfoodsCsvPath();
	const content = readFileSync(csvPath, 'utf-8');
	return parse(content, {
		columns: true,
		skip_empty_lines: true,
		comment: '#',
		relax_column_count: true,
	}) as InfoodsRow[];
}

function loadUsdaNutrients(dataDir: string): UsdaNutrientRow[] {
	const csvPath = path.join(dataDir, 'usda', 'foundation', 'nutrient.csv');
	if (!existsSync(csvPath)) {
		console.log(`  USDA nutrient.csv not found at ${csvPath} — USDA ID mapping skipped`);
		return [];
	}
	const content = readFileSync(csvPath, 'utf-8');
	return parse(content, { columns: true, skip_empty_lines: true }) as UsdaNutrientRow[];
}

export async function seedNutrients(
	prisma: PrismaClient,
	anthropic: ReturnType<typeof createAnthropic>
) {
	const scriptDir = path.dirname(new URL(import.meta.url).pathname);
	const dataDir = path.resolve(scriptDir, '../../data');

	// 1. Read and filter INFOODS tagnames
	console.log('Reading INFOODS tagnames CSV...');
	const allRows = readInfoodsRows();
	console.log(`  Total INFOODS rows: ${allRows.length}`);

	const baseRows = allRows.filter((r) => isBaseUnit(r.unit));
	console.log(`  BASE rows (valid per-100g units): ${baseRows.length}`);

	// 2. Load USDA nutrient.csv for ID mapping (optional)
	const usdaRows = loadUsdaNutrients(dataDir);
	const usdaByTagname = new Map<string, UsdaNutrientRow>();
	for (const row of usdaRows) {
		if (row.tagname) usdaByTagname.set(row.tagname.trim(), row);
	}
	if (usdaRows.length > 0) console.log(`  USDA nutrients loaded: ${usdaRows.length}`);

	// 3. Upsert INFOODS BASE rows
	console.log('Upserting nutrients...');
	let upserted = 0;

	for (const row of baseRows) {
		const usda = usdaByTagname.get(row.code);
		await prisma.nutrient.upsert({
			where: { infoodsTagname: row.code },
			create: {
				infoodsTagname: row.code,
				nameEn: row.name,
				namePl: '',
				unit: normalizeUnit(row.unit),
				category: classifyNutrient(row.code),
				usdaNutrientId: usda ? (parseInt(usda.id, 10) || null) : null,
				usdaNutrientNbr: usda?.nutrient_nbr?.trim() || null,
				displayRank: usda?.rank ? (parseInt(usda.rank, 10) || null) : null,
			},
			update: {
				nameEn: row.name,
				unit: normalizeUnit(row.unit),
				category: classifyNutrient(row.code),
				usdaNutrientId: usda ? (parseInt(usda.id, 10) || null) : null,
				usdaNutrientNbr: usda?.nutrient_nbr?.trim() || null,
				displayRank: usda?.rank ? (parseInt(usda.rank, 10) || null) : null,
			},
		});
		upserted++;
	}

	// 3b. Add USDA nutrients without an INFOODS tagname (USDA_ prefix fallback)
	for (const row of usdaRows) {
		if (row.tagname?.trim()) continue; // already covered above
		if (!row.nutrient_nbr?.trim()) continue;
		if (!isBaseUnit(row.unit_name)) continue;

		const fallbackTagname = `USDA_${row.nutrient_nbr.trim()}`;
		await prisma.nutrient.upsert({
			where: { infoodsTagname: fallbackTagname },
			create: {
				infoodsTagname: fallbackTagname,
				nameEn: row.name,
				namePl: '',
				unit: normalizeUnit(row.unit_name),
				category: classifyNutrient(fallbackTagname),
				usdaNutrientId: parseInt(row.id, 10) || null,
				usdaNutrientNbr: row.nutrient_nbr.trim(),
				displayRank: row.rank ? (parseInt(row.rank, 10) || null) : null,
			},
			update: {
				nameEn: row.name,
				usdaNutrientId: parseInt(row.id, 10) || null,
				usdaNutrientNbr: row.nutrient_nbr.trim(),
				displayRank: row.rank ? (parseInt(row.rank, 10) || null) : null,
			},
		});
		upserted++;
	}

	console.log(`  Upserted ${upserted} nutrients`);

	// 4. AI batch translate name_en → name_pl
	await translateNutrientNames(prisma, anthropic);
}

async function translateNutrientNames(
	prisma: PrismaClient,
	anthropic: ReturnType<typeof createAnthropic>
) {
	const untranslated = await prisma.nutrient.findMany({
		where: { namePl: '' },
		select: { id: true, nameEn: true },
	});

	if (untranslated.length === 0) {
		console.log('All nutrient names already translated.');
		return;
	}

	console.log(`Translating ${untranslated.length} nutrient names to Polish...`);

	const BATCH_SIZE = 50;
	let translated = 0;
	let failed = 0;

	for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
		const batch = untranslated.slice(i, i + BATCH_SIZE);
		const batchNum = Math.floor(i / BATCH_SIZE) + 1;
		const totalBatches = Math.ceil(untranslated.length / BATCH_SIZE);
		console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} names)...`);

		try {
			const { object } = await generateObject({
				model: anthropic('claude-haiku-4-5-20251001'),
				schema: z.object({
					translations: z.array(z.object({ name_en: z.string(), name_pl: z.string() })),
				}),
				prompt: `Translate the following nutrient/food component names from English to Polish.
Use standard Polish nutritional terminology (e.g., "Vitamin C" → "Witamina C", "Protein" → "Białko", "Iron" → "Żelazo").
Return exactly ${batch.length} translations in the same order, one per input name.

Names to translate:
${batch.map((n, idx) => `${idx + 1}. ${n.nameEn}`).join('\n')}`,
			});

			for (const t of object.translations) {
				const nutrient = batch.find((n) => n.nameEn === t.name_en);
				if (!nutrient?.id || !t.name_pl?.trim()) continue;
				await prisma.nutrient.update({
					where: { id: nutrient.id },
					data: { namePl: t.name_pl.trim() },
				});
				translated++;
			}
		} catch (err) {
			console.error(`  Batch ${batchNum} failed:`, err);
			failed += batch.length;
		}
	}

	console.log(`  Translated: ${translated}, Failed: ${failed}`);
}
