<script lang="ts">
	import type { FoodDocument } from "$lib/food/schema";
	import type { DraftComponent, RecipeDocument, UnitOption } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { NumberField } from "$lib/components/ui/number-field";
	import ProductPicker from "./ProductPicker.svelte";
	import { formatAmount } from "./meta";
	import { rowInfo } from "./component-row";

	// One ingredient-editor row (locked by `form.html`): drag grip + picker (product OR
	// sub-recipe) + amount + unit + remove, with a per-row gram/kcal clarifier. Purely
	// presentational — the parent `ComponentEditor` owns all draft state and reorder logic and
	// drives every change through callbacks; this row mutates nothing directly.
	type Props = {
		component: DraftComponent;
		units: UnitOption[];
		/** The amount field's display string (the parent's raw-typed buffer, comma-decimal aware). */
		amountValue: string;
		/** This row should auto-open its picker (a freshly added row), to `initialTab`. */
		autoOpen: boolean;
		initialTab: "products" | "subRecipes";
		/** Reorder visual state — true while this row is the one being dragged. */
		dragging: boolean;
		/** The recipe being edited (excluded from sub-recipe results); undefined on create. */
		excludeRecipeId?: string;
		onAmountInput: (value: string) => void;
		onUnitChange: (unitId: string) => void;
		onRemove: () => void;
		onSelectProduct: (hit: FoodDocument) => void;
		onSelectSubRecipe: (hit: RecipeDocument) => void;
		onCreateProduct: (query: string) => void;
		onPickerOpenChange: (open: boolean) => void;
		onDragStart: (e: DragEvent) => void;
		onDragEnd: () => void;
		onDrop: () => void;
	};

	let {
		component,
		units,
		amountValue,
		autoOpen,
		initialTab,
		dragging,
		excludeRecipeId,
		onAmountInput,
		onUnitChange,
		onRemove,
		onSelectProduct,
		onSelectSubRecipe,
		onCreateProduct,
		onPickerOpenChange,
		onDragStart,
		onDragEnd,
		onDrop,
	}: Props = $props();

	const unit = $derived(units.find((u) => u.id === component.unitId));
	const info = $derived(rowInfo(component, unit));
	const selection = $derived(
		component.productId || component.subRecipeId
			? {
					name: component.name,
					categorySlug: component.categorySlug,
					isSubRecipe: component.subRecipeId != null,
				}
			: null,
	);
</script>

<div
	class="ing-row"
	class:dragging
	role="listitem"
	ondragover={(e) => e.preventDefault()}
	ondrop={(e) => {
		e.preventDefault();
		onDrop();
	}}
>
	<span
		class="grip"
		role="button"
		tabindex="0"
		draggable="true"
		aria-label={t("recipe.form.removeRow")}
		ondragstart={onDragStart}
		ondragend={onDragEnd}
	>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<circle cx="7.5" cy="5" r="1.3" /><circle cx="12.5" cy="5" r="1.3" /><circle
				cx="7.5"
				cy="10"
				r="1.3"
			/><circle cx="12.5" cy="10" r="1.3" /><circle cx="7.5" cy="15" r="1.3" /><circle
				cx="12.5"
				cy="15"
				r="1.3"
			/>
		</svg>
	</span>

	<ProductPicker
		{selection}
		{autoOpen}
		initialTab={autoOpen ? initialTab : "products"}
		{excludeRecipeId}
		onSelectProduct={(hit) => onSelectProduct(hit)}
		onSelectSubRecipe={(hit) => onSelectSubRecipe(hit)}
		onCreateProduct={(query) => onCreateProduct(query)}
		onOpenChange={(o) => onPickerOpenChange(o)}
	/>

	<NumberField
		type="text"
		inputmode="decimal"
		inputClass="px-2.5 py-[9px] text-[0.875rem]"
		value={amountValue}
		oninput={(e) => onAmountInput(e.currentTarget.value)}
		placeholder="—"
		aria-label={t("recipe.form.amountLabel")}
	/>
	<span class="unit">
		<select
			value={component.unitId}
			onchange={(e) => onUnitChange(e.currentTarget.value)}
			aria-label={t("recipe.form.unitLabel")}
		>
			{#each units as u (u.id)}
				<option value={u.id}>{u.namePl}</option>
			{/each}
		</select>
		<svg class="uchev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
			><path d="M10 13.5l-4.5-5h9z" /></svg
		>
	</span>
	<IconButton
		type="button"
		variant="ghost"
		size="sm"
		class="size-[30px]"
		aria-label={t("recipe.form.removeRow")}
		onclick={onRemove}
	>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
			><path
				d="M5.7 5.7a1 1 0 0 1 1.4 0L10 8.6l2.9-2.9a1 1 0 1 1 1.4 1.4L11.4 10l2.9 2.9a1 1 0 0 1-1.4 1.4L10 11.4l-2.9 2.9a1 1 0 0 1-1.4-1.4L8.6 10 5.7 7.1a1 1 0 0 1 0-1.4Z"
			/></svg
		>
	</IconButton>

	{#if info && ((info.grams != null && !info.direct) || info.kcal != null || info.partial)}
		<div class="ing-sub">
			{#if info.grams != null && !info.direct}
				<span>= <b>{formatAmount(info.grams)} g</b></span>
			{/if}
			{#if info.kcal != null}
				{#if info.grams != null && !info.direct}<span class="sepd"></span>{/if}
				<span><b>{formatAmount(info.kcal)}</b> kcal</span>
			{/if}
			{#if info.partial}
				{#if (info.grams != null && !info.direct) || info.kcal != null}<span class="sepd"
					></span>{/if}
				<span class="part">
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
						><path
							fill-rule="evenodd"
							d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"
							clip-rule="evenodd"
						/></svg
					>
					{t("recipe.form.partialRow")}
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.ing-row {
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr) 74px 104px 30px;
		gap: 9px;
		align-items: center;
	}
	.ing-row.dragging {
		opacity: 0.45;
	}
	.grip {
		color: var(--muted-foreground);
		opacity: 0.5;
		cursor: grab;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.grip:active {
		cursor: grabbing;
	}
	.grip svg {
		width: 15px;
		height: 15px;
	}
	.unit select {
		width: 100%;
		font-family: inherit;
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 9px 10px;
		outline: none;
	}
	.unit select:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.unit {
		position: relative;
	}
	.unit select {
		appearance: none;
		-webkit-appearance: none;
		padding-right: 26px;
		cursor: pointer;
	}
	.unit .uchev {
		position: absolute;
		right: 9px;
		top: 50%;
		transform: translateY(-50%);
		width: 13px;
		height: 13px;
		color: var(--muted-foreground);
		pointer-events: none;
	}
	.ing-sub {
		grid-column: 2 / 4;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		padding: 1px 2px 3px;
		flex-wrap: wrap;
	}
	.ing-sub .sepd {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.45;
		flex-shrink: 0;
	}
	.ing-sub b {
		color: var(--foreground);
		font-weight: 550;
		font-variant-numeric: tabular-nums;
	}
	.ing-sub .part {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.ing-sub .part svg {
		width: 12px;
		height: 12px;
	}
</style>
