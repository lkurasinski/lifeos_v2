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

/**
 * Static map: INFOODS tagname → USDA nutrient ID.
 *
 * The USDA full/foundation nutrient.csv has no tagname column, so we can't
 * build this mapping from the CSV at runtime. This covers all 234 USDA
 * nutrient IDs present in Foundation Foods data, mapping ~223 of them to
 * canonical INFOODS tagnames in our DB.
 *
 * Unmapped USDA IDs (11):
 *   1008  Energy (KCAL)         — no KCAL energy tagname in INFOODS
 *   1024  Specific Gravity      — non-nutrient
 *   1110  Vitamin D (IU)        — IU is not a BASE_UNIT
 *   1194  Choline, free         — no INFOODS equivalent
 *   1195  Choline from phosphocholine
 *   1197  Choline from glycerophosphocholine
 *   1198  Betaine               — no INFOODS equivalent
 *   1199  Choline from sphingomyelin
 *   1409  PUFA 18:3i            — isomeric form, no clean match
 *   2047  Energy (Atwater General, KCAL)
 *   2048  Energy (Atwater Specific, KCAL)
 */
const INFOODS_TO_USDA_ID: Record<string, number> = {
	// Proximate
	NT: 1002,
	PROCNT: 1003,
	FAT: 1004,
	CHOCDF: 1005,
	CHOCSM: 1050,
	ASH: 1007,
	STARCH: 1009,
	SUCS: 1010,
	GLUS: 1011,
	FRUS: 1012,
	LACS: 1013,
	MALS: 1014,
	CITAC: 1032,
	MALAC: 1039,
	OXALAC: 1041,
	PYRUAC: 1043,
	QUINAC: 1044,
	WATER: 1051,
	ENERC: 1062,
	SUGAR: 1063,
	STARES: 1071,
	GALS: 1075,
	RAFS: 1076,
	STAS: 1077,
	FIBTG: 1079,
	HMWDF: 2038,
	LMWDF: 2065,
	FIBSOL: 1082,
	FIBINS: 1084,
	FATNLEA: 1085,
	// Minerals
	CA: 1087,
	FE: 1089,
	MG: 1090,
	P: 1091,
	K: 1092,
	NA: 1093,
	S: 1094,
	ZN: 1095,
	CO: 1097,
	CU: 1098,
	ID: 1100,
	MN: 1101,
	MO: 1102,
	SE: 1103,
	B: 1137,
	NI: 1146,
	// Fat-soluble vitamins
	RETOL: 1105,
	VITA: 1106,
	TOCPHA: 1109,
	ERGCAL: 1111,
	CHOCAL: 1112,
	CHOCALOH: 1113,
	VITD: 1114,
	VITD4: 2059,
	VITE: 2068,
	MK4: 1183,
	VITK1D: 1184,
	VITK1: 1185,
	// Carotenoids
	CARTA: 1108,
	CARTB: 1107,
	CARTBCIS: 1159,
	CARTBT: 2028,
	CARTG: 1118,
	CRYPXA: 2032,
	CRYPXB: 1120,
	LUTN: 1121,
	LYCPN: 1122,
	LYCPNCIS: 1160,
	LYCPNT: 2029,
	LZEA: 1123,
	LZEAC: 1161,
	PHYTOENE: 1116,
	PHYFLU: 1117,
	ZEA: 1119,
	// Tocopherols / tocotrienols
	TOCPHB: 1125,
	TOCPHG: 1126,
	TOCPHD: 1127,
	TOCTRA: 1128,
	TOCTRB: 1129,
	TOCTRG: 1130,
	TOCTRD: 1131,
	// Water-soluble vitamins
	VITC: 1162,
	THIA: 1165,
	RIBF: 1166,
	NIAC: 1167,
	PANTAC: 1170,
	VITB6A: 1175,
	BIOT: 1176,
	FOL: 1177,
	VITB12: 1178,
	CHOLN: 1180,
	MTHF5: 1188,
	'10FFOLAC': 1191,
	FTHF5: 1192,
	// Amino acids
	TRP: 1210,
	THR: 1211,
	ILE: 1212,
	LEU: 1213,
	LYS: 1214,
	MET: 1215,
	CYS: 1216,
	PHE: 1217,
	TYR: 1218,
	VAL: 1219,
	ARG: 1220,
	HIS: 1221,
	ALA: 1222,
	ASP: 1223,
	GLU: 1224,
	GLY: 1225,
	PRO: 1226,
	SER: 1227,
	HYP: 1228,
	CYSTE: 1232,
	// Lipids — total / aggregate
	CHOLE: 1253,
	FASAT: 1258,
	FAMS: 1292,
	FAPU: 1293,
	FATRN: 1257,
	FATRNM: 1329,
	FADT: 1330,
	FATRNP: 1331,
	// Saturated fatty acids
	F4D0: 1259,
	F5D0: 2003,
	F6D0: 1260,
	F7D0: 2004,
	F8D0: 1261,
	F9D0: 2005,
	F10D0: 1262,
	F11D0: 1335,
	F12D0: 1263,
	F13D0: 1332,
	F14D0: 1264,
	F15D0: 1299,
	F16D0: 1265,
	F17D0: 1300,
	F18D0: 1266,
	F20D0: 1267,
	F21D0: 2006,
	F22D0: 1273,
	F23D0: 2007,
	F24D0: 1301,
	// Monounsaturated fatty acids
	F12D1: 2008,
	F14D1: 1274,
	F14D1C: 2009,
	F14D1T: 1281,
	F15D1: 1333,
	F16D1: 1275,
	F16D1C: 1314,
	F16D1T: 1303,
	F17D1: 1323,
	F17D1C: 2010,
	F18D1: 1268,
	F18D1C: 1315,
	F18D1T: 1304,
	F18D1N7: 1413,
	F20D1: 1277,
	F20D1C: 2012,
	F20D1T: 2013,
	F22D1: 1279,
	F22D1N9: 2014,
	F22D1CN11: 2015,
	F22D1TN9: 1305,
	F24D1C: 1312,
	// Polyunsaturated fatty acids
	F18D2: 1269,
	F18D2C: 2016,
	F18D2CN6: 1316,
	F18D2CLA: 1311,
	F18D2T: 1306,
	F18D3: 1270,
	F18D3CN3: 1404,
	F18D3N6: 1321,
	F18D3T: 2019,
	F18D4: 1276,
	F20D2: 2026,
	F20D2CN6: 1313,
	F20D3: 1325,
	F20D3C: 2020,
	F20D3N3: 1405,
	F20D3N6: 1406,
	F20D3N9: 1414,
	F20D4: 1271,
	F20D4C: 2022,
	F20D4N3: 1407,
	F20D4N6: 1408,
	F20D5: 2023,
	F20D5N3: 1278,
	F22D2: 1334,
	F22D3: 2021,
	F22D4: 1411,
	F22D5: 2024,
	F22D5N3: 1280,
	F22D6: 2025,
	F22D6N3: 1272,
	// Sterols / phytosterols
	ERGSTR: 1284,
	STGSTR: 1285,
	CAMD5: 1286,
	BRASTR: 1287,
	SITSTR: 1288,
	CAMSTL: 1289,
	SITSTL: 1294,
	AVED5: 1296,
	PHYSTROTH: 1298,
	STIGMA7: 2052,
	STGMD: 2053,
	ERG7ENOL: 2060,
	ERG7D22DIENOL: 2061,
	ERG5D7DIENOL: 2062,
	// Isoflavones
	DDZEIN: 1340,
	GNSTEIN: 1341,
	DAIDZN: 2049,
	GNSTIN: 2050,
	GLYCTN: 2051,
	// Carbohydrate fractions
	VERS: 2063,
	GLUCNB: 2058,
	// Other bioactives
	EGT: 2057,
	GSH: 2069,
};

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
		const staticUsdaId = INFOODS_TO_USDA_ID[row.code] ?? null;
		const usdaNutrientId = usda ? (parseInt(usda.id, 10) || null) : staticUsdaId;
		await prisma.nutrient.upsert({
			where: { infoodsTagname: row.code },
			create: {
				infoodsTagname: row.code,
				nameEn: row.name,
				namePl: '',
				unit: normalizeUnit(row.unit),
				category: classifyNutrient(row.code),
				usdaNutrientId,
				usdaNutrientNbr: usda?.nutrient_nbr?.trim() || null,
				displayRank: usda?.rank ? (parseInt(usda.rank, 10) || null) : null,
			},
			update: {
				nameEn: row.name,
				unit: normalizeUnit(row.unit),
				category: classifyNutrient(row.code),
				usdaNutrientId,
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
