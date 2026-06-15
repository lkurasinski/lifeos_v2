<script lang="ts">
	import type { RecipeTaxonomies, TaxonomyRef } from "$lib/recipe/schema";
	import { Chip } from "$lib/components/ui/chip";
	import { SelectField } from "$lib/components/ui/select-field";
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

{#snippet check()}
	<svg class="size-[13px]" viewBox="0 0 20 20" aria-hidden="true"
		><path
			d="M4.5 10.5l3.2 3.2 7-7"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/></svg
	>
{/snippet}

{#snippet plus()}
	<svg class="size-[13px]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
		><path
			d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z"
		/></svg
	>
{/snippet}

{#snippet taxChips(label: string, kind: TaxKind)}
	<div class="metafield">
		<span class="flab">{label}</span>
		<div class="mchips">
			{#each taxonomies[kind] as row (row.id)}
				<Chip
					active={isTaxSelected(kind, row.id)}
					leading={isTaxSelected(kind, row.id) ? check : undefined}
					onclick={() => toggleTax(kind, row.id)}
				>
					{row.namePl}
				</Chip>
			{/each}
			{#each customNames(kind) as name (name)}
				<Chip active leading={check} onclick={() => removeCustom(kind, name)}>
					{name}
				</Chip>
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
				<Chip variant="add" leading={plus} onclick={() => openAdd(kind)}>
					{t("recipe.form.addChip")}
				</Chip>
			{/if}
		</div>
	</div>
{/snippet}

<div class="metafield">
	<span class="flab">{t("recipe.form.mealLabel")}</span>
	<div class="mchips">
		{#each mealTypesSorted as mt (mt.id)}
			<Chip
				active={mealTypeIds.includes(mt.id)}
				leading={mealTypeIds.includes(mt.id) ? check : undefined}
				onclick={() => toggleMeal(mt.id)}
			>
				{mt.namePl}
			</Chip>
		{/each}
	</div>
</div>

{@render taxChips(t("recipe.form.dietLabel"), "diets")}
{@render taxChips(t("recipe.form.techniqueLabel"), "techniques")}
{@render taxChips(t("recipe.form.allergenLabel"), "allergens")}

<div class="metafield">
	<span class="flab">{t("recipe.form.cuisineLabel")}</span>
	<SelectField
		value={cuisineId ?? ""}
		onchange={onCuisineChange}
		aria-label={t("recipe.form.cuisineLabel")}
	>
		<option value="">{t("recipe.form.cuisineNone")}</option>
		{#each taxonomies.cuisines as c (c.id)}
			<option value={c.id}>{c.namePl}</option>
		{/each}
	</SelectField>
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
</style>
