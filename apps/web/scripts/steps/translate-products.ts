/**
 * Step: translate
 *
 * Batch translate all FoodProduct rows where namePl IS NULL using Anthropic Haiku.
 * Idempotent: only queries namePl=null rows, safe to re-run after partial failures.
 * Cost: ~$0.05 for ~400 Foundation Foods.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { createAnthropic } from '@ai-sdk/anthropic';

const BATCH_SIZE = 50;

export async function translateProducts(
	prisma: PrismaClient,
	anthropic: ReturnType<typeof createAnthropic>
) {
	const untranslated = await prisma.foodProduct.findMany({
		where: { namePl: null },
		select: { id: true, nameEn: true },
	});

	if (untranslated.length === 0) {
		console.log('All product names already translated.');
		return;
	}

	console.log(`Translating ${untranslated.length} product names to Polish...`);

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
					translations: z.array(
						z.object({ name_en: z.string(), name_pl: z.string() })
					),
				}),
				prompt: `Translate the following food product names from English to Polish.
Use standard Polish food terminology. Keep product descriptions accurate and natural-sounding.
Return exactly ${batch.length} translations in the same order as the input.

Names to translate:
${batch.map((n, idx) => `${idx + 1}. ${n.nameEn}`).join('\n')}`,
			});

			for (const t of object.translations) {
				const product = batch.find((p) => p.nameEn === t.name_en);
				if (!product?.id || !t.name_pl?.trim()) continue;
				await prisma.foodProduct.update({
					where: { id: product.id },
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
