<script lang="ts">
	import { untrack } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import { MacroBar } from "$lib/components/ui/macro-bar";
	import { NumberField } from "$lib/components/ui/number-field";
	import { Panel } from "$lib/components/ui/panel";
	import { toast } from "$lib/components/ui/sonner";
	import { MACRO, type Macro } from "$lib/components/ui/gauge";
	import type { Tone } from "$lib/components/ui/status/status.svelte";
	import { t } from "$lib/i18n";
	import { saveTargets } from "./save-targets";

	// The "Cele żywieniowe" screen (locked probe `targets.html`) realized with shared
	// primitives + tokens: a hero editable calorie number on a solid/energy panel, a 3-up
	// grid of editable macro-gram fields each carrying its identity-colour dot + live derived
	// kcal/%, a composition split bar, and the screen's single scored element — a live
	// reconciliation panel (macros→kcal via 4/4/9 vs the calorie target). NULL ≠ 0: an empty
	// field is "no target", distinct from a typed 0, and is sent (and persisted) as null.
	type TargetsSeed = {
		caloriesKcal: number | null;
		proteinG: number | null;
		carbsG: number | null;
		fatG: number | null;
	};

	let { targets }: { targets: TargetsSeed | null } = $props();

	// Seed once from the loaded record (NULL stays NULL). `saved` is the last-persisted
	// snapshot the dirty flag and Reset compare against; it advances on a successful save.
	const seed: TargetsSeed = untrack(() => ({
		caloriesKcal: targets?.caloriesKcal ?? null,
		proteinG: targets?.proteinG ?? null,
		carbsG: targets?.carbsG ?? null,
		fatG: targets?.fatG ?? null,
	}));

	let caloriesKcal = $state<number | null>(seed.caloriesKcal);
	let proteinG = $state<number | null>(seed.proteinG);
	let carbsG = $state<number | null>(seed.carbsG);
	let fatG = $state<number | null>(seed.fatG);
	let saved = $state<TargetsSeed>({ ...seed });

	let saving = $state(false);
	let errorMessage = $state<string | null>(null);

	// Atwater: protein/carbs 4 kcal/g, fat 9. Null counts as 0 for the calc only (the field
	// itself stays null end-to-end). Numbers format with the pl-PL thousands separator.
	const z = (v: number | null) => v ?? 0;
	const fmt = (n: number) => Math.round(n).toLocaleString("pl-PL");

	const proteinKcal = $derived(4 * z(proteinG));
	const carbsKcal = $derived(4 * z(carbsG));
	const fatKcal = $derived(9 * z(fatG));
	const macroKcal = $derived(proteinKcal + carbsKcal + fatKcal);
	const pctOf = (kcal: number) => (macroKcal > 0 ? Math.round((kcal / macroKcal) * 100) : 0);

	type MacroRow = {
		key: "proteinG" | "carbsG" | "fatG";
		macro: Macro;
		label: string;
		aria: string;
		value: number | null;
		kcal: number;
	};
	const macroRows = $derived<MacroRow[]>([
		{
			key: "proteinG",
			macro: "pro",
			label: t("nutritionTargets.macros.protein"),
			aria: t("nutritionTargets.macros.proteinAria"),
			value: proteinG,
			kcal: proteinKcal,
		},
		{
			key: "carbsG",
			macro: "carb",
			label: t("nutritionTargets.macros.carbs"),
			aria: t("nutritionTargets.macros.carbsAria"),
			value: carbsG,
			kcal: carbsKcal,
		},
		{
			key: "fatG",
			macro: "fat",
			label: t("nutritionTargets.macros.fat"),
			aria: t("nutritionTargets.macros.fatAria"),
			value: fatG,
			kcal: fatKcal,
		},
	]);

	function setMacro(key: MacroRow["key"], v: number | null) {
		if (key === "proteinG") proteinG = v;
		else if (key === "carbsG") carbsG = v;
		else fatG = v;
	}

	// Reconciliation: shown only when a calorie target and ≥1 macro are present. macros→kcal
	// vs the target, mapped to a scored tone (probe thresholds: ≤2% positive, ≤8% caution,
	// else destructive). Advisory only — never blocks save and is never part of the payload.
	const hasCalorie = $derived(caloriesKcal !== null);
	const hasAnyMacro = $derived(proteinG !== null || carbsG !== null || fatG !== null);
	const showRecon = $derived(hasCalorie && hasAnyMacro);

	const cal = $derived(z(caloriesKcal));
	const delta = $derived(macroKcal - cal);
	const ratio = $derived(cal > 0 ? Math.abs(delta) / cal : macroKcal > 0 ? 1 : 0);
	const tone = $derived<Tone>(
		ratio <= 0.02 ? "positive" : ratio <= 0.08 ? "caution" : "destructive",
	);
	const reconValue = $derived(cal > 0 ? Math.min(100, (macroKcal / cal) * 100) : 0);

	const statusLabel = $derived(
		tone === "positive"
			? t("nutritionTargets.recon.statusOk")
			: tone === "caution"
				? t("nutritionTargets.recon.statusWarn")
				: t("nutritionTargets.recon.statusOver"),
	);
	const deltaLabel = $derived(
		Math.abs(delta) < 1
			? t("nutritionTargets.recon.exact")
			: delta < 0
				? `${fmt(-delta)} ${t("nutritionTargets.recon.below")}`
				: `${fmt(delta)} ${t("nutritionTargets.recon.above")}`,
	);
	const deltaToneClass = $derived(
		tone === "positive"
			? "text-positive"
			: tone === "caution"
				? "text-caution"
				: "text-destructive",
	);

	const dirty = $derived(
		caloriesKcal !== saved.caloriesKcal ||
			proteinG !== saved.proteinG ||
			carbsG !== saved.carbsG ||
			fatG !== saved.fatG,
	);

	function reset() {
		caloriesKcal = saved.caloriesKcal;
		proteinG = saved.proteinG;
		carbsG = saved.carbsG;
		fatG = saved.fatG;
		errorMessage = null;
	}

	async function save() {
		if (saving) return;
		saving = true;
		errorMessage = null;
		const outcome = await saveTargets({ caloriesKcal, proteinG, carbsG, fatG });
		saving = false;
		if (outcome === "ok") {
			saved = { caloriesKcal, proteinG, carbsG, fatG };
			toast.success(t("nutritionTargets.saved"));
		} else {
			errorMessage = t("nutritionTargets.saveError");
			toast.error(t("nutritionTargets.saveError"));
		}
	}
</script>

<Panel variant="thick" class="nt flex flex-col overflow-hidden rounded-lg p-0">
	<div class="px-[26px] pb-1 pt-6 max-md:px-[18px]">
		<div
			class="inline-flex items-center gap-[7px] text-[0.5625rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground"
		>
			<svg viewBox="0 0 20 20" fill="currentColor" class="h-[14px] w-[14px]" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM10 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z"
					clip-rule="evenodd"
				/>
			</svg>
			{t("nutritionTargets.eyebrow")}
		</div>
		<p class="mt-2.5 max-w-[46ch] text-[0.875rem] leading-[1.5] text-muted-foreground">
			{t("nutritionTargets.lead")}
		</p>
	</div>

	<!-- HERO — editable calorie target on a near-solid backing; energy identity (coral). -->
	<Panel
		variant="solid"
		class="mx-[26px] mb-1 mt-[18px] flex items-center justify-between gap-[18px] rounded-lg px-6 py-[22px] max-md:mx-[18px] max-md:flex-col max-md:items-start max-md:gap-[14px]"
	>
		<div class="max-md:order-2">
			<div
				class="inline-flex items-center gap-[7px] text-[0.625rem] font-medium uppercase tracking-[0.07em] text-muted-foreground"
			>
				<span class="h-2 w-2 shrink-0 rounded-full" style={MACRO.kcal}></span>
				{t("nutritionTargets.hero.label")}
			</div>
			<p class="mt-[7px] max-w-[24ch] text-[0.75rem] leading-[1.45] text-muted-foreground">
				{t("nutritionTargets.hero.sub")}
			</p>
		</div>
		<span class="flex shrink-0 items-baseline max-md:order-1 max-md:self-start">
			<input
				type="number"
				min="0"
				inputmode="numeric"
				class="kcal-input w-[4.4ch] rounded-sm border border-transparent bg-transparent px-1.5 py-0.5 text-right text-[3.5rem] font-light leading-none tracking-[-0.02em] tabular-nums text-foreground outline-none hover:border-[color:var(--border)] focus-visible:border-transparent focus-visible:bg-card focus-visible:shadow-[var(--focus)] max-md:text-[3rem]"
				bind:value={caloriesKcal}
				aria-label={t("nutritionTargets.hero.ariaLabel")}
			/>
			<span class="ml-2 text-base font-medium text-muted-foreground"
				>{t("nutritionTargets.hero.unit")}</span
			>
		</span>
	</Panel>

	<!-- MAKRA — editable gram fields; identity dot + live derived kcal/% per macro. -->
	<div class="px-[26px] pt-1.5 max-md:px-[18px]">
		<div
			class="mb-[11px] mt-[18px] flex items-center gap-2 text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground"
		>
			{t("nutritionTargets.macrosLabel")}
			<span class="ml-auto text-[0.6875rem] font-normal normal-case tracking-normal"
				>{t("nutritionTargets.macrosHint")}</span
			>
		</div>
		<div class="grid grid-cols-3 gap-3 max-md:gap-[9px]">
			{#each macroRows as m (m.key)}
				<div class="flex flex-col gap-2">
					<span
						class="flex items-center gap-[7px] text-[0.6875rem] font-medium tracking-[0.03em] text-foreground"
					>
						<span class="h-2 w-2 shrink-0 rounded-full" style={MACRO[m.macro]}></span>{m.label}
					</span>
					<NumberField
						value={m.value}
						oninput={(e) => {
							const v = e.currentTarget.valueAsNumber;
							setMacro(m.key, Number.isNaN(v) ? null : v);
						}}
						class="w-full"
						unit={t("nutritionTargets.gramUnit")}
						inputClass="text-left text-[1.375rem] font-light py-[11px] pl-[13px] pr-[38px]"
						min="0"
						inputmode="numeric"
						aria-label={m.aria}
					/>
					<span
						class="flex items-center justify-between px-0.5 text-[0.6875rem] tabular-nums text-muted-foreground"
					>
						<span>{fmt(m.kcal)} {t("nutritionTargets.kcalSuffix")}</span>
						<span class="font-semibold text-foreground">{pctOf(m.kcal)}%</span>
					</span>
				</div>
			{/each}
		</div>

		<!-- Composition split bar — identity colour per segment (proportion, not a score). -->
		<div class="mt-3.5">
			<div class="flex h-[9px] gap-0.5 overflow-hidden rounded-pill bg-accent">
				{#each macroRows as m (m.key)}
					<span
						class="block h-full"
						style="{MACRO[m.macro]};width:{pctOf(m.kcal)}%;background:var(--gc)"
					></span>
				{/each}
			</div>
			<div class="mt-2.5 flex flex-wrap items-center gap-x-[18px] gap-y-2">
				{#each macroRows as m (m.key)}
					<span
						class="inline-flex items-center gap-[7px] text-[0.6875rem] tabular-nums text-muted-foreground"
					>
						<span
							class="h-[9px] w-[9px] shrink-0 rounded-[3px]"
							style="{MACRO[m.macro]};background:var(--gc)"
						></span>{m.label}
						<b class="font-semibold text-foreground">{pctOf(m.kcal)}%</b>
					</span>
				{/each}
				{#if hasAnyMacro}
					<!-- Always-visible energy sum from the macros, independent of the calorie target
					     (the reconciliation panel below only renders once a target is also set). -->
					<span
						class="ml-auto inline-flex items-baseline gap-1.5 text-[0.6875rem] tabular-nums text-muted-foreground"
					>
						{t("nutritionTargets.totalLabel")}
						<b class="text-[0.8125rem] font-semibold text-foreground"
							>{fmt(macroKcal)} {t("nutritionTargets.kcalSuffix")}</b
						>
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- UZGODNIENIE — the screen's single scored element: macros→kcal vs target (live). -->
	{#if showRecon}
		<div
			class="mx-[26px] mb-1 mt-5 rounded-lg bg-card px-[18px] py-4 shadow-[inset_0_0_0_1px_var(--hairline)] max-md:mx-[18px]"
		>
			<div class="flex items-baseline justify-between gap-3">
				<div class="text-[0.8125rem] font-semibold tracking-[-0.005em]">
					{t("nutritionTargets.recon.title")}
					<span class="mt-0.5 block text-[0.6875rem] font-normal text-muted-foreground"
						>{t("nutritionTargets.recon.subtitle")}</span
					>
				</div>
				<div class="shrink-0 text-right">
					<div class="text-2xl font-light leading-none tracking-[-0.01em] tabular-nums">
						{fmt(macroKcal)}<span
							class="ml-[0.18em] text-[0.42em] font-medium text-muted-foreground"
							>{t("nutritionTargets.kcalSuffix")}</span
						>
					</div>
					<div class="mt-[3px] text-[0.6875rem] tabular-nums text-muted-foreground">
						{t("nutritionTargets.recon.targetPrefix")}
						{fmt(cal)}
						{t("nutritionTargets.kcalSuffix")}
					</div>
				</div>
			</div>
			<MacroBar value={reconValue} {tone} class="my-[13px]" />
			<div class="flex items-center gap-2.5">
				<span class={["text-[0.75rem] font-medium tabular-nums", deltaToneClass]}>{deltaLabel}</span
				>
				<span class={["ml-auto text-[0.75rem] font-medium", deltaToneClass]}>{statusLabel}</span>
			</div>
		</div>
	{/if}

	<!-- Loop note — static for now (planning consumes targets in a later slice). -->
	<div class="mx-[26px] mb-1 mt-[18px] flex items-start gap-[9px] max-md:mx-[18px]">
		<svg
			viewBox="0 0 20 20"
			fill="currentColor"
			class="mt-px h-[15px] w-[15px] shrink-0 text-muted-foreground"
			aria-hidden="true"
		>
			<path
				d="M10 3a7 7 0 0 0-6.32 4 .9.9 0 0 0 1.62.78A5.2 5.2 0 0 1 10 4.8c1.9 0 3.57.99 4.5 2.5h-1.6a.9.9 0 0 0 0 1.8h3.5a.9.9 0 0 0 .9-.9V4.7a.9.9 0 0 0-1.8 0v1.06A6.99 6.99 0 0 0 10 3Z"
			/>
			<path
				d="M16.32 13a.9.9 0 0 0-1.62-.78A5.2 5.2 0 0 1 10 15.2c-1.9 0-3.57-.99-4.5-2.5h1.6a.9.9 0 0 0 0-1.8H3.6a.9.9 0 0 0-.9.9v3.5a.9.9 0 0 0 1.8 0v-1.06A6.99 6.99 0 0 0 10 17a7 7 0 0 0 6.32-4Z"
				opacity=".5"
			/>
		</svg>
		<span class="text-[0.75rem] leading-[1.5] text-muted-foreground"
			>{t("nutritionTargets.loopNote")}</span
		>
	</div>

	<!-- Sticky glass action bar — the weightier action (Save) sits on the right. -->
	<div class="nt-bar">
		<Button type="button" variant="ghost" onclick={reset} disabled={!dirty || saving}>
			{t("nutritionTargets.reset")}
		</Button>
		<span class="flex-1"></span>
		{#if dirty}
			<span
				class="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-pill bg-card py-1.5 pl-[9px] pr-[11px] text-[0.6875rem] font-semibold tracking-[0.04em] text-foreground shadow-soft"
			>
				<span class="nt-pulse"></span>{t("nutritionTargets.dirty")}
			</span>
		{/if}
		<Button onclick={save} disabled={!dirty || saving}>
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					d="M4.5 3A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5V7.2a1.5 1.5 0 0 0-.44-1.06l-2.7-2.7A1.5 1.5 0 0 0 12.8 3H4.5Zm1 1.8h6V8h-6V4.8ZM10 14.6a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z"
				/>
			</svg>
			{saving ? t("nutritionTargets.saving") : t("nutritionTargets.save")}
		</Button>
	</div>
	{#if errorMessage}
		<p class="px-[26px] pb-3 text-center text-[0.6875rem] text-destructive max-md:px-[18px]">
			{errorMessage}
		</p>
	{/if}
</Panel>

<style>
	/* Entrance animation — scoped keyframe applied to the Panel root via the `nt` class. */
	@media (prefers-reduced-motion: no-preference) {
		:global(.nt) {
			animation: nt-materialize 0.54s var(--ease-expo) both;
		}
		@keyframes nt-materialize {
			from {
				opacity: 0;
				transform: translateY(11px) scale(0.985);
			}
		}
	}

	/* "Unsaved" pulse dot — neutral (colour is reserved for the scored recon panel). */
	.nt-pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--muted-foreground);
		position: relative;
	}
	.nt-pulse::after {
		content: "";
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		border: 1.5px solid var(--muted-foreground);
		opacity: 0.45;
		animation: nt-ring 2s var(--ease) infinite;
	}
	@keyframes nt-ring {
		0% {
			transform: scale(0.6);
			opacity: 0.5;
		}
		100% {
			transform: scale(1.5);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.nt-pulse::after {
			animation: none;
		}
	}

	/* Sticky glass action bar — frosted material with a solid fallback. */
	.nt-bar {
		position: sticky;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 20px;
		padding: 15px 22px;
		background: var(--glass-fill-thick);
		backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		-webkit-backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		border-top: 1px solid var(--hairline);
	}
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.nt-bar {
			background: var(--card);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.nt-bar {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--card);
		}
	}
	@media (max-width: 768px) {
		.nt-bar {
			padding-left: 16px;
			padding-right: 16px;
		}
	}
</style>
