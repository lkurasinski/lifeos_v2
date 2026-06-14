<script lang="ts">
	import { Gauge } from "$lib/components/ui/gauge";
	import { Panel } from "$lib/components/ui/panel";
	import { SegmentedToggle } from "$lib/components/ui/segmented";
	import {
		rollupRecipe,
		MACRO_TAGS,
		type RollupComponent,
		type ProductNutrition,
		type SubRecipeNutrition,
	} from "$lib/recipe/nutrition";
	import type { UnitConversion } from "$lib/recipe/units";
	import type { DraftComponent, UnitOption } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import { RECIPE_MACRO_REFERENCE, formatAmount, macroPct } from "./meta";

	// The authoring form's LIVE per-serving rollup (locked by `form.html`): recomputed
	// client-side via the Phase 2 engine from the draft components' picked previews, with a
	// per-serving/total toggle, the four macro rings, a component count, and an honest
	// partial-data banner naming components whose nutrition is incomplete. Owns only the
	// presentation + the `basis` toggle; the draft itself stays in `RecipeForm`.
	type Props = {
		components: DraftComponent[];
		servings: number;
		units: UnitOption[];
		/** Count of contributing components — owned by `RecipeForm` (also drives its section header). */
		componentCount: number;
	};

	let { components, servings, units, componentCount }: Props = $props();

	const unitById = $derived<Record<string, UnitOption>>(
		Object.fromEntries(units.map((u) => [u.id, u])),
	);

	let basis = $state<"perServing" | "total">("perServing");

	const rollup = $derived.by(() => {
		const productMap: Record<string, ProductNutrition> = {};
		const subMap: Record<string, SubRecipeNutrition> = {};
		const comps: RollupComponent[] = [];
		for (const c of components) {
			const u = unitById[c.unitId];
			if (!u || c.amount == null || c.amount <= 0) continue;
			const unit: UnitConversion = { kind: u.kind, baseFactor: u.baseFactor };
			if (c.productId) {
				productMap[c.productId] = {
					densityGPerMl: c.preview.densityGPerMl ?? null,
					pieceWeightG: c.preview.pieceWeightG ?? null,
					nutrientsPer100g: c.preview.nutrientsPer100g ?? {},
				};
				comps.push({ kind: "product", refId: c.productId, name: c.name, amount: c.amount, unit });
			} else if (c.subRecipeId) {
				subMap[c.subRecipeId] = {
					totals: c.preview.totals ?? {},
					yieldWeightG: c.preview.yieldWeightG ?? null,
					nutritionComplete: c.preview.nutritionComplete ?? false,
				};
				comps.push({
					kind: "subRecipe",
					refId: c.subRecipeId,
					name: c.name,
					amount: c.amount,
					unit,
				});
			}
		}
		return rollupRecipe(
			comps,
			servings,
			(id) => productMap[id] ?? null,
			(id) => subMap[id] ?? null,
		);
	});

	const shown = $derived(basis === "perServing" ? rollup.perServing : rollup.totals);
	const kcal = $derived(shown[MACRO_TAGS.energyKcal] ?? 0);

	type GaugeDef = {
		macro: "kcal" | "pro" | "carb" | "fat";
		tag: string;
		label: string;
		unit: string;
		max: number;
	};
	const gaugeDefs = $derived<GaugeDef[]>([
		{
			macro: "kcal",
			tag: MACRO_TAGS.energyKcal,
			label: t("recipe.macros.energy"),
			unit: "kcal",
			max: RECIPE_MACRO_REFERENCE.kcal,
		},
		{
			macro: "pro",
			tag: MACRO_TAGS.protein,
			label: t("recipe.macros.protein"),
			unit: "g",
			max: RECIPE_MACRO_REFERENCE.protein,
		},
		{
			macro: "carb",
			tag: MACRO_TAGS.carbs,
			label: t("recipe.macros.carbs"),
			unit: "g",
			max: RECIPE_MACRO_REFERENCE.carbs,
		},
		{
			macro: "fat",
			tag: MACRO_TAGS.fat,
			label: t("recipe.macros.fat"),
			unit: "g",
			max: RECIPE_MACRO_REFERENCE.fat,
		},
	]);

	const basisItems = $derived([
		{ value: "perServing", label: t("recipe.form.perServing") },
		{ value: "total", label: t("recipe.form.total") },
	]);
</script>

<Panel variant="solid" class="rollup">
	<div class="ru-h">
		<span class="ti">{t("recipe.form.nutritionTitle")}</span>
		<span class="live"><span class="d"></span>{t("recipe.form.live")}</span>
		<SegmentedToggle
			class="ru-seg"
			items={basisItems}
			value={basis}
			aria-label={t("recipe.form.nutritionTitle")}
			onValueChange={(v) => (basis = (v || "perServing") as "perServing" | "total")}
		/>
	</div>
	<div class="ru-kcal">
		<span class="v">{new Intl.NumberFormat("pl-PL").format(Math.round(kcal))}</span>
		<span class="u"
			>{basis === "perServing" ? t("recipe.form.kcalPerServing") : t("recipe.form.kcalTotal")}</span
		>
	</div>
	<div class="gauges">
		{#each gaugeDefs as g (g.macro)}
			{@const value = shown[g.tag] ?? 0}
			<Gauge
				macro={g.macro}
				size={70}
				value={macroPct(value, g.max)}
				display={formatAmount(value)}
				unit={g.unit}
				label={g.label}
			/>
		{/each}
	</div>
	<div class="ru-foot">
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
			><path
				d="M7 5h9M7 10h9M7 15h9"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linecap="round"
				fill="none"
			/><circle cx="3.5" cy="5" r="1.2" /><circle cx="3.5" cy="10" r="1.2" /><circle
				cx="3.5"
				cy="15"
				r="1.2"
			/></svg
		>
		{t("recipe.form.fromComponentsPrefix")} <b>{componentCount}</b>
		{t("recipe.form.fromComponentsSuffix")}
	</div>
	{#if !rollup.nutritionComplete && rollup.incompleteComponents.length > 0}
		<div class="ru-honest">
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
				><path
					fill-rule="evenodd"
					d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"
					clip-rule="evenodd"
				/></svg
			>
			<p>
				<b>{t("recipe.form.partialTitle")}</b>
				{t("recipe.form.partialIntro")}
				{#each rollup.incompleteComponents as ic, i (`${ic.kind}:${ic.refId}`)}{i > 0
						? ", "
						: " "}„{ic.name}"{/each}.
				{t("recipe.form.partialOutro")}
			</p>
		</div>
	{/if}
</Panel>

<style>
	/* ── side: rollup ── */
	:global(.rollup) {
		padding: 18px;
		border-radius: var(--radius);
	}
	.ru-h {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 15px;
		flex-wrap: wrap;
	}
	.ru-h .ti {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
	.ru-h .live {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
	.ru-h .live .d {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--positive, oklch(0.62 0.13 152));
	}
	@media (prefers-reduced-motion: no-preference) {
		.ru-h .live .d {
			animation: blink 1.6s var(--ease) infinite;
		}
	}
	@keyframes blink {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}
	.ru-h :global(.ru-seg) {
		margin-left: auto;
	}
	.ru-kcal {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 16px;
	}
	.ru-kcal .v {
		font-weight: 300;
		letter-spacing: -0.02em;
		font-size: 2.625rem;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
	}
	.ru-kcal .u {
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
	.gauges {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}
	.ru-foot {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		margin-top: 15px;
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.ru-foot svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}
	.ru-foot b {
		color: var(--foreground);
		font-weight: 550;
		font-variant-numeric: tabular-nums;
	}
	.ru-honest {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-top: 12px;
		padding: 9px 11px;
		border-radius: var(--radius-sm);
		background: var(--secondary);
		color: var(--muted-foreground);
	}
	.ru-honest svg {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		margin-top: 1px;
	}
	.ru-honest p {
		font-size: 0.6875rem;
		line-height: 1.45;
	}
	.ru-honest b {
		color: var(--foreground);
		font-weight: 550;
	}
</style>
