<script lang="ts">
	import { untrack, type Snippet } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import { Gauge } from "$lib/components/ui/gauge";
	import { Panel } from "$lib/components/ui/panel";
	import { SegmentedToggle } from "$lib/components/ui/segmented";
	import type { FoodCategoryMeta, NutrientRegistryGroup } from "$lib/food/schema";
	import {
		rollupRecipe,
		MACRO_TAGS,
		type RollupComponent,
		type ProductNutrition,
		type SubRecipeNutrition,
	} from "$lib/recipe/nutrition";
	import type { UnitConversion } from "$lib/recipe/units";
	import type {
		RecipeDraft,
		RecipeTaxonomies,
		RecipeDifficulty,
		UnitOption,
	} from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import ComponentEditor from "./ComponentEditor.svelte";
	import StepsEditor from "./StepsEditor.svelte";
	import { RECIPE_MACRO_REFERENCE, formatAmount, macroPct, compareMealTypes, difficultyOptions } from "./meta";

	// The recipe authoring surface (locked by `form.html`): left column = name/description,
	// ingredient editor, metadata chips, steps, tips; right sticky column = the LIVE per-serving
	// rollup (recomputed client-side via the Phase 2 engine) + publication (status × visibility);
	// a sticky action bar commits as draft or published. Mirrors `ProductForm`'s prop shape
	// (draft / options / mode / saving / errorMessage / onSubmit / onCancel) + a delete affordance.
	type Props = {
		draft: RecipeDraft;
		taxonomies: RecipeTaxonomies;
		units: UnitOption[];
		registry: NutrientRegistryGroup[];
		categories: FoodCategoryMeta[];
		mode: "create" | "edit";
		saving?: boolean;
		errorMessage?: string | null;
		/** The recipe being edited (excluded from its own sub-recipe picker); undefined on create. */
		excludeRecipeId?: string;
		onSubmit: (draft: RecipeDraft) => void;
		onCancel?: () => void;
		/** Owner delete (edit mode only) — the host opens the confirm + DELETE round-trip. */
		onDelete?: () => void;
	};

	let {
		draft,
		taxonomies,
		units,
		registry,
		categories,
		mode,
		saving = false,
		errorMessage = null,
		excludeRecipeId,
		onSubmit,
		onCancel,
		onDelete,
	}: Props = $props();

	// Editable copy, seeded ONCE (the host remounts via {#key} when the loaded draft changes).
	let data = $state<RecipeDraft>(untrack(() => structuredClone(draft)));
	let localError = $state<string | null>(null);

	// The ingredient picker's popover overflows its glass section; each glass `Panel` is its own
	// stacking context (backdrop-filter), so a trapped `z-index` paints behind the next section.
	// Lift the ingredients section above its siblings while a picker is open.
	let pickerOpen = $state(false);

	const mealTypesSorted = $derived([...taxonomies.mealTypes].sort((a, b) => compareMealTypes(a.slug, b.slug)));
	const difficulties = difficultyOptions();
	const unitById = $derived<Record<string, UnitOption>>(Object.fromEntries(units.map((u) => [u.id, u])));

	// ─── Live nutrition rollup (Phase 2 engine, client-side) ─────────────────────────
	let basis = $state<"perServing" | "total">("perServing");

	const rollup = $derived.by(() => {
		const productMap: Record<string, ProductNutrition> = {};
		const subMap: Record<string, SubRecipeNutrition> = {};
		const comps: RollupComponent[] = [];
		for (const c of data.components) {
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
				comps.push({ kind: "subRecipe", refId: c.subRecipeId, name: c.name, amount: c.amount, unit });
			}
		}
		return rollupRecipe(
			comps,
			data.servings,
			(id) => productMap[id] ?? null,
			(id) => subMap[id] ?? null,
		);
	});

	const shown = $derived(basis === "perServing" ? rollup.perServing : rollup.totals);
	const kcal = $derived(shown[MACRO_TAGS.energyKcal] ?? 0);
	const componentCount = $derived(
		data.components.filter((c) => (c.productId || c.subRecipeId) && c.amount != null && c.amount > 0).length,
	);

	type GaugeDef = { macro: "kcal" | "pro" | "carb" | "fat"; tag: string; label: string; unit: string; max: number };
	const gaugeDefs = $derived<GaugeDef[]>([
		{ macro: "kcal", tag: MACRO_TAGS.energyKcal, label: t("recipe.macros.energy"), unit: "kcal", max: RECIPE_MACRO_REFERENCE.kcal },
		{ macro: "pro", tag: MACRO_TAGS.protein, label: t("recipe.macros.protein"), unit: "g", max: RECIPE_MACRO_REFERENCE.protein },
		{ macro: "carb", tag: MACRO_TAGS.carbs, label: t("recipe.macros.carbs"), unit: "g", max: RECIPE_MACRO_REFERENCE.carbs },
		{ macro: "fat", tag: MACRO_TAGS.fat, label: t("recipe.macros.fat"), unit: "g", max: RECIPE_MACRO_REFERENCE.fat },
	]);

	const basisItems = $derived([
		{ value: "perServing", label: t("recipe.form.perServing") },
		{ value: "total", label: t("recipe.form.total") },
	]);

	// ─── Taxonomy chips (meal-type by id; diet/technique/allergen as id-or-name refs) ──
	type TaxKind = "diets" | "techniques" | "allergens";

	function toggleMeal(id: string) {
		data.mealTypeIds = data.mealTypeIds.includes(id)
			? data.mealTypeIds.filter((m) => m !== id)
			: [...data.mealTypeIds, id];
	}
	function isTaxSelected(kind: TaxKind, id: string): boolean {
		return data[kind].some((r) => r.id === id);
	}
	function toggleTax(kind: TaxKind, id: string) {
		data[kind] = isTaxSelected(kind, id)
			? data[kind].filter((r) => r.id !== id)
			: [...data[kind], { id }];
	}
	function customNames(kind: TaxKind): string[] {
		return data[kind].filter((r) => r.name != null).map((r) => r.name as string);
	}
	function addCustom(kind: TaxKind, raw: string) {
		const name = raw.trim();
		if (!name) return;
		const exists = data[kind].some((r) => r.name?.toLowerCase() === name.toLowerCase());
		if (!exists) data[kind] = [...data[kind], { name }];
	}
	function removeCustom(kind: TaxKind, name: string) {
		data[kind] = data[kind].filter((r) => r.name !== name);
	}

	let addingKind = $state<TaxKind | null>(null);
	let addingValue = $state("");
	function openAdd(kind: TaxKind) {
		addingKind = kind;
		addingValue = "";
	}
	function commitAdd() {
		if (addingKind) addCustom(addingKind, addingValue);
		addingKind = null;
		addingValue = "";
	}
	function cancelAdd() {
		addingKind = null;
		addingValue = "";
	}

	function onCuisineChange(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		data.cuisineId = v || null;
	}

	// ─── Submit ───────────────────────────────────────────────────────────────────────
	const canSave = $derived(data.name.trim() !== "" && !saving);

	function submitAs(status: "DRAFT" | "PUBLISHED") {
		if (saving) return;
		if (data.name.trim() === "") {
			localError = t("recipe.form.nameRequired");
			return;
		}
		localError = null;
		data.status = status;
		onSubmit($state.snapshot(data) as RecipeDraft);
	}

	const barError = $derived(errorMessage ?? localError);
</script>

{#snippet sectHead(icon: Snippet, title: string, count: string | null)}
	<div class="sect-h">
		<span class="icn">{@render icon()}</span>
		<span class="ti">{title}</span>
		{#if count}<span class="ct">{count}</span>{/if}
	</div>
{/snippet}

{#snippet listIcon()}<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7 5h9M7 10h9M7 15h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none" /><circle cx="3.5" cy="5" r="1.2" /><circle cx="3.5" cy="10" r="1.2" /><circle cx="3.5" cy="15" r="1.2" /></svg>{/snippet}
{#snippet slidersIcon()}<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4 6h7M14 6h2M4 14h2M9 14h7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none" /><circle cx="12.5" cy="6" r="2.1" /><circle cx="7.5" cy="14" r="2.1" /></svg>{/snippet}
{#snippet stepsIcon()}<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 15h4v-4H3zM8 11h4V7H8zM13 7h4V3h-4z" opacity=".9" /></svg>{/snippet}
{#snippet bulbIcon()}<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2.2a5.3 5.3 0 0 0-3.2 9.5c.5.4.8.9.9 1.5l.1.8h4.4l.1-.8c.1-.6.4-1.1.9-1.5A5.3 5.3 0 0 0 10 2.2Z" /><path d="M7.7 16.2h4.6M8.4 17.8h3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>{/snippet}

{#snippet taxChips(label: string, kind: TaxKind)}
	<div class="metafield">
		<span class="flab">{label}</span>
		<div class="mchips">
			{#each taxonomies[kind] as row (row.id)}
				<button type="button" class="mchip" class:on={isTaxSelected(kind, row.id)} onclick={() => toggleTax(kind, row.id)}>
					{#if isTaxSelected(kind, row.id)}<svg class="ck" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4.5 10.5l3.2 3.2 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
					{row.namePl}
				</button>
			{/each}
			{#each customNames(kind) as name (name)}
				<button type="button" class="mchip on" onclick={() => removeCustom(kind, name)}>
					<svg class="ck" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4.5 10.5l3.2 3.2 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
					{name}
				</button>
			{/each}
			{#if addingKind === kind}
				<input
					class="mchip-input"
					bind:value={addingValue}
					placeholder={t("recipe.form.addChipPlaceholder")}
					aria-label={t("recipe.form.addChip")}
					{@attach (node) => node.focus()}
					onkeydown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							commitAdd();
						} else if (e.key === "Escape") {
							cancelAdd();
						}
					}}
					onblur={commitAdd}
				/>
			{:else}
				<button type="button" class="mchip mchip--add" onclick={() => openAdd(kind)}>
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z" /></svg>
					{t("recipe.form.addChip")}
				</button>
			{/if}
		</div>
	</div>
{/snippet}

<div class="flow">
	<!-- ── LEFT: editors ── -->
	<div class="col-main">
		<Panel variant="thick" class="sect">
			<input class="namebig" type="text" bind:value={data.name} placeholder={t("recipe.form.namePlaceholder")} aria-label={t("recipe.form.namePlaceholder")} />
			<textarea class="descbox" bind:value={data.description} placeholder={t("recipe.form.descPlaceholder")} aria-label={t("recipe.form.descPlaceholder")}></textarea>
		</Panel>

		<Panel variant="thick" class={pickerOpen ? "sect sect-elevated" : "sect"}>
			{@render sectHead(listIcon, t("recipe.form.ingredientsTitle"), `${componentCount} ${t("recipe.form.itemsCount")}`)}
			<ComponentEditor
				bind:components={data.components}
				{units}
				{registry}
				{categories}
				{excludeRecipeId}
				onPickerOpenChange={(o) => (pickerOpen = o)}
			/>
		</Panel>

		<Panel variant="thick" class="sect">
			{@render sectHead(slidersIcon, t("recipe.form.detailsTitle"), null)}
			<div class="metagrid">
				<div class="nums">
					<label class="numf">
						<span class="flab">{t("recipe.form.servingsLabel")}</span>
						<span class="numwrap"><input type="number" inputmode="numeric" min="1" step="1" bind:value={data.servings} aria-label={t("recipe.form.servingsLabel")} /></span>
					</label>
					<label class="numf">
						<span class="flab">{t("recipe.form.prepLabel")}</span>
						<span class="numwrap"><input type="number" inputmode="numeric" min="0" step="1" bind:value={data.prepTimeMin} aria-label={t("recipe.form.prepLabel")} /><span class="nu">{t("recipe.form.minUnit")}</span></span>
					</label>
					<label class="numf">
						<span class="flab">{t("recipe.form.cookLabel")}</span>
						<span class="numwrap"><input type="number" inputmode="numeric" min="0" step="1" bind:value={data.cookTimeMin} aria-label={t("recipe.form.cookLabel")} /><span class="nu">{t("recipe.form.minUnit")}</span></span>
					</label>
				</div>

				<div class="metafield">
					<span class="flab">{t("recipe.form.difficultyLabel")}</span>
					<SegmentedToggle
						items={difficulties.map((d) => ({ value: d.value, label: d.label }))}
						value={data.difficulty ?? ""}
						aria-label={t("recipe.form.difficultyLabel")}
						onValueChange={(v) => (data.difficulty = (v || null) as RecipeDifficulty | null)}
					/>
				</div>

				<div class="metafield">
					<span class="flab">{t("recipe.form.mealLabel")}</span>
					<div class="mchips">
						{#each mealTypesSorted as mt (mt.id)}
							<button type="button" class="mchip" class:on={data.mealTypeIds.includes(mt.id)} onclick={() => toggleMeal(mt.id)}>
								{#if data.mealTypeIds.includes(mt.id)}<svg class="ck" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4.5 10.5l3.2 3.2 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
								{mt.namePl}
							</button>
						{/each}
					</div>
				</div>

				{@render taxChips(t("recipe.form.dietLabel"), "diets")}
				{@render taxChips(t("recipe.form.techniqueLabel"), "techniques")}
				{@render taxChips(t("recipe.form.allergenLabel"), "allergens")}

				<div class="metafield">
					<span class="flab">{t("recipe.form.cuisineLabel")}</span>
					<span class="selwrap">
						<select value={data.cuisineId ?? ""} onchange={onCuisineChange} aria-label={t("recipe.form.cuisineLabel")}>
							<option value="">{t("recipe.form.cuisineNone")}</option>
							{#each taxonomies.cuisines as c (c.id)}
								<option value={c.id}>{c.namePl}</option>
							{/each}
						</select>
						<svg class="schev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 13.5l-4.5-5h9z" /></svg>
					</span>
				</div>
			</div>
		</Panel>

		<Panel variant="thick" class="sect">
			{@render sectHead(stepsIcon, t("recipe.form.stepsTitle"), null)}
			<StepsEditor bind:steps={data.steps} />
		</Panel>

		<Panel variant="thick" class="sect">
			{@render sectHead(bulbIcon, t("recipe.form.tipsTitle"), `${data.tips.length}`)}
			<div class="tipslist">
				{#each data.tips as tip, i (i)}
					<div class="tipe">
						<span class="ti"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2.2a5.3 5.3 0 0 0-3.2 9.5c.5.4.8.9.9 1.5l.1.8h4.4l.1-.8c.1-.6.4-1.1.9-1.5A5.3 5.3 0 0 0 10 2.2Z" /></svg></span>
						<input type="text" value={tip} oninput={(e) => (data.tips[i] = e.currentTarget.value)} aria-label={t("recipe.form.tipsTitle")} />
						<button type="button" class="rm" aria-label={t("recipe.form.removeRow")} onclick={() => (data.tips = data.tips.filter((_, j) => j !== i))}>
							<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.7 5.7a1 1 0 0 1 1.4 0L10 8.6l2.9-2.9a1 1 0 1 1 1.4 1.4L11.4 10l2.9 2.9a1 1 0 0 1-1.4 1.4L10 11.4l-2.9 2.9a1 1 0 0 1-1.4-1.4L8.6 10 5.7 7.1a1 1 0 0 1 0-1.4Z" /></svg>
						</button>
					</div>
				{/each}
				<button type="button" class="addbtn" onclick={() => (data.tips = [...data.tips, ""])}>
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z" /></svg>
					{t("recipe.form.tipPlaceholder")}
				</button>
			</div>
		</Panel>
	</div>

	<!-- ── RIGHT: live rollup + publication (sticky) ── -->
	<div class="col-side">
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
				<span class="u">{basis === "perServing" ? t("recipe.form.kcalPerServing") : t("recipe.form.kcalTotal")}</span>
			</div>
			<div class="gauges">
				{#each gaugeDefs as g (g.macro)}
					{@const value = shown[g.tag] ?? 0}
					<Gauge macro={g.macro} size={70} value={macroPct(value, g.max)} display={formatAmount(value)} unit={g.unit} label={g.label} />
				{/each}
			</div>
			<div class="ru-foot">
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7 5h9M7 10h9M7 15h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none" /><circle cx="3.5" cy="5" r="1.2" /><circle cx="3.5" cy="10" r="1.2" /><circle cx="3.5" cy="15" r="1.2" /></svg>
				{t("recipe.form.fromComponentsPrefix")} <b>{componentCount}</b> {t("recipe.form.fromComponentsSuffix")}
			</div>
			{#if !rollup.nutritionComplete && rollup.incompleteComponents.length > 0}
				<div class="ru-honest">
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z" clip-rule="evenodd" /></svg>
					<p>
						<b>{t("recipe.form.partialTitle")}</b>
						{t("recipe.form.partialIntro")}
						{#each rollup.incompleteComponents as ic, i (`${ic.kind}:${ic.refId}`)}{i > 0 ? ", " : " "}„{ic.name}"{/each}.
						{t("recipe.form.partialOutro")}
					</p>
				</div>
			{/if}
		</Panel>

		<Panel class="pub">
			<div class="pub-h">{t("recipe.form.publishTitle")}</div>
			<div class="pubf">
				<div class="pl">{t("recipe.form.statusLabel")}</div>
				<div class="pd">{t("recipe.form.statusHint")}</div>
				<SegmentedToggle
					class="w-full"
					items={[
						{ value: "DRAFT", label: t("recipe.form.statusDraft") },
						{ value: "PUBLISHED", label: t("recipe.form.statusPublished") },
					]}
					value={data.status}
					aria-label={t("recipe.form.statusLabel")}
					onValueChange={(v) => (data.status = (v || "DRAFT") as "DRAFT" | "PUBLISHED")}
				/>
			</div>
			<div class="pubf">
				<div class="pl">{t("recipe.form.visibilityLabel")}</div>
				<div class="pd">{t("recipe.form.visibilityHint")}</div>
				<SegmentedToggle
					class="w-full"
					items={[
						{ value: "PUBLIC", label: t("recipe.form.visibilityPublic") },
						{ value: "PRIVATE", label: t("recipe.form.visibilityPrivate") },
					]}
					value={data.visibility}
					aria-label={t("recipe.form.visibilityLabel")}
					onValueChange={(v) => (data.visibility = (v || "PUBLIC") as "PUBLIC" | "PRIVATE")}
				/>
			</div>
		</Panel>
	</div>
</div>

<!-- sticky action bar -->
<div class="formbar">
	{#if mode === "edit" && onDelete}
		<button type="button" class="ghost" onclick={() => onDelete?.()}>{t("recipe.form.deleteRecipe")}</button>
	{:else if onCancel}
		<button type="button" class="ghost" onclick={() => onCancel?.()}>{t("common.cancel")}</button>
	{/if}
	<span class="spacer"></span>
	<span class={["meta", barError ? "err" : ""]}>
		{#if barError}
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z" clip-rule="evenodd" /></svg>
			{barError}
		{:else}
			{t("recipe.form.unsavedNote")}
		{/if}
	</span>
	<Button variant="secondary" disabled={!canSave} onclick={() => submitAs("DRAFT")}>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4.5 3A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5V7.2a1.5 1.5 0 0 0-.44-1.06l-2.7-2.7A1.5 1.5 0 0 0 12.8 3H4.5Zm1 1.8h6V8h-6V4.8ZM10 14.6a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" /></svg>
		{saving ? t("recipe.form.saving") : t("recipe.form.saveDraft")}
	</Button>
	<Button disabled={!canSave} onclick={() => submitAs("PUBLISHED")}>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4.5 10.5l3.2 3.2 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
		{saving ? t("recipe.form.saving") : t("recipe.form.publish")}
	</Button>
</div>

<style>
	.flow {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 384px;
		gap: 20px;
		padding: 16px 24px 40px;
		align-items: start;
		max-width: 1280px;
		margin-inline: auto;
	}
	.col-main {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}
	.col-side {
		position: sticky;
		top: 84px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}

	:global(.sect) {
		padding: 18px 20px 19px;
		border-radius: var(--radius);
	}
	/* While a picker popover is open, lift this section's glass stacking context above the
	   following sections so the overflowing popover isn't painted behind them. */
	:global(.sect-elevated) {
		position: relative;
		z-index: 30;
	}
	.sect-h {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 15px;
	}
	.sect-h .icn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--muted-foreground);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.sect-h .icn :global(svg) {
		width: 16px;
		height: 16px;
	}
	.sect-h .ti {
		font-size: 1.0625rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--foreground);
	}
	.sect-h .ct {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.namebig {
		width: 100%;
		font-family: inherit;
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.2;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 12px 14px;
		outline: none;
	}
	.namebig:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.namebig::placeholder {
		color: var(--muted-foreground);
		font-weight: 500;
	}
	.descbox {
		width: 100%;
		margin-top: 10px;
		font-family: inherit;
		font-size: 0.9375rem;
		line-height: 1.55;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 11px 14px;
		outline: none;
		resize: vertical;
		min-height: 74px;
	}
	.descbox:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.descbox::placeholder {
		color: var(--muted-foreground);
	}

	.metagrid {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.metafield {
		display: flex;
		flex-direction: column;
	}
	.flab {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-bottom: 8px;
	}
	.nums {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	.numf {
		display: flex;
		flex-direction: column;
	}
	.numwrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	.numwrap input {
		width: 100%;
		font-family: inherit;
		font-size: 0.9375rem;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 10px 38px 10px 12px;
		outline: none;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.numwrap input::-webkit-outer-spin-button,
	.numwrap input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.numwrap input:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.numwrap .nu {
		position: absolute;
		right: 11px;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		pointer-events: none;
	}

	.mchips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.mchip {
		font-size: 0.75rem;
		font-weight: 500;
		padding: 6px 12px;
		border-radius: var(--radius-pill);
		border: 0;
		cursor: pointer;
		background: var(--secondary);
		color: var(--muted-foreground);
		font-family: inherit;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.mchip:hover:not(.on) {
		background: var(--accent);
		color: var(--foreground);
	}
	.mchip.on {
		background: var(--primary);
		color: var(--primary-foreground);
	}
	.mchip.on .ck {
		width: 13px;
		height: 13px;
		margin-left: -2px;
	}
	.mchip--add {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--border);
		color: var(--muted-foreground);
	}
	.mchip--add:hover {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--muted-foreground);
		color: var(--foreground);
	}
	.mchip--add svg {
		width: 13px;
		height: 13px;
		margin-left: -1px;
	}
	.mchip-input {
		font-family: inherit;
		font-size: 0.75rem;
		border: 0;
		background: var(--card);
		box-shadow: var(--focus);
		border-radius: var(--radius-pill);
		padding: 6px 12px;
		outline: none;
		width: 128px;
		color: var(--foreground);
	}
	.mchip-input::placeholder {
		color: var(--muted-foreground);
	}

	.selwrap {
		position: relative;
	}
	.selwrap select {
		width: 100%;
		appearance: none;
		-webkit-appearance: none;
		font-family: inherit;
		font-size: 0.9375rem;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 10px 34px 10px 12px;
		outline: none;
		cursor: pointer;
	}
	.selwrap select:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.selwrap .schev {
		position: absolute;
		right: 11px;
		top: 50%;
		transform: translateY(-50%);
		width: 14px;
		height: 14px;
		color: var(--muted-foreground);
		pointer-events: none;
	}

	.tipslist {
		display: flex;
		flex-direction: column;
		gap: 9px;
	}
	.tipe {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) 30px;
		gap: 10px;
		align-items: center;
	}
	.tipe .ti {
		color: var(--muted-foreground);
		display: flex;
		justify-content: center;
	}
	.tipe .ti svg {
		width: 15px;
		height: 15px;
	}
	.tipe input {
		width: 100%;
		font-family: inherit;
		font-size: 0.875rem;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 9px 12px;
		outline: none;
	}
	.tipe input:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.tipe input::placeholder {
		color: var(--muted-foreground);
	}
	.rm {
		border: 0;
		background: transparent;
		cursor: pointer;
		color: var(--muted-foreground);
		width: 30px;
		height: 30px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.rm:hover {
		background: var(--accent);
		color: var(--foreground);
	}
	.rm svg {
		width: 16px;
		height: 16px;
	}
	.addbtn {
		display: inline-flex;
		align-self: flex-start;
		align-items: center;
		gap: 7px;
		border: 0;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--foreground);
		background: var(--card);
		box-shadow: var(--shadow-soft);
		border-radius: var(--radius-sm);
		padding: 9px 13px;
		cursor: pointer;
		margin-top: 4px;
	}
	.addbtn:hover {
		background: var(--accent);
	}
	.addbtn svg {
		width: 15px;
		height: 15px;
		color: var(--muted-foreground);
	}

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

	/* ── side: publication ── */
	:global(.pub) {
		padding: 16px 18px 18px;
		border-radius: var(--radius);
	}
	.pub-h {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-bottom: 13px;
	}
	.pubf {
		margin-bottom: 13px;
	}
	.pubf:last-child {
		margin-bottom: 0;
	}
	.pubf .pl {
		font-size: 0.8125rem;
		font-weight: 550;
		margin-bottom: 3px;
		color: var(--foreground);
	}
	.pubf .pd {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		line-height: 1.4;
		margin-bottom: 8px;
	}

	/* ── sticky action bar ── */
	.formbar {
		position: sticky;
		bottom: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 15px 24px;
		background: var(--glass-fill-thick);
		backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		-webkit-backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		border-top: 1px solid var(--hairline);
	}
	.formbar .ghost {
		border: 0;
		background: transparent;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 13px 12px;
		border-radius: var(--radius-sm);
	}
	.formbar .ghost:hover {
		background: var(--accent);
		color: var(--foreground);
	}
	.formbar .spacer {
		flex: 1;
	}
	.formbar .meta {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		margin-right: 6px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 40ch;
	}
	.formbar .meta.err {
		color: var(--destructive);
	}
	.formbar .meta svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.formbar {
			background: var(--card);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.formbar {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--card);
		}
	}

	/* Collapse to a single column below the two-column breakpoint (Phase 7 refines mobile). */
	@media (max-width: 960px) {
		.flow {
			grid-template-columns: minmax(0, 1fr);
		}
		.col-side {
			position: static;
			order: -1;
		}
	}
	@media (max-width: 768px) {
		.flow {
			padding: 14px 16px 40px;
		}
		.nums {
			grid-template-columns: 1fr;
		}
	}
</style>
