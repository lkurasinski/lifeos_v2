<script lang="ts">
	import type { RecipeTaxonomies, TaxonomyRef } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import { compareMealTypes } from "./meta";

	// The recipe form's metadata-taxonomy block (locked by `form.html`): meal-type chips
	// (selected by id), diet/technique/allergen chips (closed-set toggles + free-text
	// `Dodaj` refs), and the cuisine select. Owns the local "adding a custom chip" state;
	// the draft selections are bound back to the parent via `$bindable` slices, so this stays
	// a focused editor without reaching into the whole `RecipeDraft`.
	type Props = {
		taxonomies: RecipeTaxonomies;
		mealTypeIds: string[];
		diets: TaxonomyRef[];
		techniques: TaxonomyRef[];
		allergens: TaxonomyRef[];
		cuisineId: string | null;
	};

	let {
		taxonomies,
		mealTypeIds = $bindable(),
		diets = $bindable(),
		techniques = $bindable(),
		allergens = $bindable(),
		cuisineId = $bindable(),
	}: Props = $props();

	type TaxKind = "diets" | "techniques" | "allergens";

	const mealTypesSorted = $derived(
		[...taxonomies.mealTypes].sort((a, b) => compareMealTypes(a.slug, b.slug)),
	);

	// Read/write the bound ref array for a kind. Separate `$bindable` slices can't be indexed
	// by a string key, so route through these so the chip handlers stay generic over `kind`.
	function refs(kind: TaxKind): TaxonomyRef[] {
		return kind === "diets" ? diets : kind === "techniques" ? techniques : allergens;
	}
	function setRefs(kind: TaxKind, next: TaxonomyRef[]) {
		if (kind === "diets") diets = next;
		else if (kind === "techniques") techniques = next;
		else allergens = next;
	}

	function toggleMeal(id: string) {
		mealTypeIds = mealTypeIds.includes(id)
			? mealTypeIds.filter((m) => m !== id)
			: [...mealTypeIds, id];
	}
	function isTaxSelected(kind: TaxKind, id: string): boolean {
		return refs(kind).some((r) => r.id === id);
	}
	function toggleTax(kind: TaxKind, id: string) {
		setRefs(
			kind,
			isTaxSelected(kind, id) ? refs(kind).filter((r) => r.id !== id) : [...refs(kind), { id }],
		);
	}
	function customNames(kind: TaxKind): string[] {
		return refs(kind)
			.filter((r) => r.name != null)
			.map((r) => r.name as string);
	}
	function addCustom(kind: TaxKind, raw: string) {
		const name = raw.trim();
		if (!name) return;
		const exists = refs(kind).some((r) => r.name?.toLowerCase() === name.toLowerCase());
		if (!exists) setRefs(kind, [...refs(kind), { name }]);
	}
	function removeCustom(kind: TaxKind, name: string) {
		setRefs(
			kind,
			refs(kind).filter((r) => r.name !== name),
		);
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
		cuisineId = v || null;
	}
</script>

{#snippet taxChips(label: string, kind: TaxKind)}
	<div class="metafield">
		<span class="flab">{label}</span>
		<div class="mchips">
			{#each taxonomies[kind] as row (row.id)}
				<button
					type="button"
					class="mchip"
					class:on={isTaxSelected(kind, row.id)}
					onclick={() => toggleTax(kind, row.id)}
				>
					{#if isTaxSelected(kind, row.id)}<svg
							class="ck"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
							><path
								d="M4.5 10.5l3.2 3.2 7-7"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/></svg
						>{/if}
					{row.namePl}
				</button>
			{/each}
			{#each customNames(kind) as name (name)}
				<button type="button" class="mchip on" onclick={() => removeCustom(kind, name)}>
					<svg class="ck" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
						><path
							d="M4.5 10.5l3.2 3.2 7-7"
							fill="none"
							stroke="currentColor"
							stroke-width="2.2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
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
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
						><path
							d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z"
						/></svg
					>
					{t("recipe.form.addChip")}
				</button>
			{/if}
		</div>
	</div>
{/snippet}

<div class="metafield">
	<span class="flab">{t("recipe.form.mealLabel")}</span>
	<div class="mchips">
		{#each mealTypesSorted as mt (mt.id)}
			<button
				type="button"
				class="mchip"
				class:on={mealTypeIds.includes(mt.id)}
				onclick={() => toggleMeal(mt.id)}
			>
				{#if mealTypeIds.includes(mt.id)}<svg
						class="ck"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
						><path
							d="M4.5 10.5l3.2 3.2 7-7"
							fill="none"
							stroke="currentColor"
							stroke-width="2.2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>{/if}
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
		<select
			value={cuisineId ?? ""}
			onchange={onCuisineChange}
			aria-label={t("recipe.form.cuisineLabel")}
		>
			<option value="">{t("recipe.form.cuisineNone")}</option>
			{#each taxonomies.cuisines as c (c.id)}
				<option value={c.id}>{c.namePl}</option>
			{/each}
		</select>
		<svg class="schev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
			><path d="M10 13.5l-4.5-5h9z" /></svg
		>
	</span>
</div>

<style>
	/* Field-row primitives — duplicated from RecipeForm (shared layout, kept self-contained). */
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
</style>
