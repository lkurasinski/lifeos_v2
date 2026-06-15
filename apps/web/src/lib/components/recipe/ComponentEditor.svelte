<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Dialog } from "$lib/components/ui/dialog";
	import ProductForm from "$lib/components/catalog/ProductForm.svelte";
	import {
		draftToSavePayload,
		emptyDraft,
		type DraftProduct,
		type FoodDocument,
		type FoodCategoryMeta,
		type NutrientRegistryGroup,
	} from "$lib/food/schema";
	import type {
		DraftComponent,
		RecipeDetailView,
		RecipeDocument,
		UnitOption,
	} from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import { formatDecimalPl } from "$lib/decimal";
	import ComponentRow from "./ComponentRow.svelte";
	import { parseAmount } from "./component-row";

	// The ingredient editor (locked by `form.html`): ordered rows = picker (product OR sub-recipe)
	// + amount + unit + remove, with a drag grip to reorder and a per-row gram/kcal clarifier.
	// `Dodaj składnik` / `Dodaj pod-przepis` append a row with its picker pre-opened to the right
	// tab. Picking a product reads the search hit directly; a sub-recipe pick fetches the cached
	// `(totals, yieldWeightG)` pair for the live panel; `Utwórz produkt` opens an embedded
	// `ProductForm` (the foods add flow) whose save fills the row WITHOUT losing this draft.
	type Props = {
		components: DraftComponent[];
		units: UnitOption[];
		registry: NutrientRegistryGroup[];
		categories: FoodCategoryMeta[];
		/** The recipe being edited (excluded from sub-recipe results); undefined on create. */
		excludeRecipeId?: string;
		/** Bubbles "a row's picker popover is open" so the host can lift the section's z-index. */
		onPickerOpenChange?: (open: boolean) => void;
	};

	let {
		components = $bindable(),
		units,
		registry,
		categories,
		excludeRecipeId,
		onPickerOpenChange,
	}: Props = $props();

	// Track which rows have an open picker; report whether ANY is open (a glass panel clips the
	// popover behind the next section otherwise — the host raises this section while open).
	let openRows = $state<Record<string, boolean>>({});
	const anyPickerOpen = $derived(Object.values(openRows).some(Boolean));
	$effect(() => {
		onPickerOpenChange?.(anyPickerOpen);
	});

	const defaultUnitId = $derived(units.find((u) => u.slug === "g")?.id ?? units[0]?.id ?? "");

	// Which freshly-added row should auto-open its picker, and to which tab.
	let autoOpenKey = $state<string | null>(null);
	let autoOpenTab = $state<"products" | "subRecipes">("products");

	function newKey(): string {
		return crypto.randomUUID();
	}

	// Amount entry is a TEXT field (not `type=number`) so pl-PL comma decimals reach the live
	// preview: a number input rejects "," in many locales, leaving `c.amount` (and the rollup)
	// empty until the server save re-parses. A per-row raw buffer holds exactly what the user
	// typed so a mid-typing "1," isn't clobbered by the parsed value; `c.amount` is the parsed
	// number the rollup reads. Mirrors ProductForm's `parseAmount`; the server re-validates via
	// `amountSchema` (which also accepts the comma string) regardless.
	let amountRaw = $state<Record<string, string>>({});

	function amountDisplay(c: DraftComponent): string {
		if (amountRaw[c.key] !== undefined) return amountRaw[c.key];
		return c.amount != null ? formatDecimalPl(c.amount) : "";
	}

	function onAmountInput(key: string, raw: string) {
		amountRaw[key] = raw;
		const c = components.find((x) => x.key === key);
		if (c) c.amount = parseAmount(raw);
	}

	function addRow(tab: "products" | "subRecipes") {
		const key = newKey();
		autoOpenKey = key;
		autoOpenTab = tab;
		components.push({
			key,
			productId: null,
			subRecipeId: null,
			name: "",
			categorySlug: null,
			amount: null,
			unitId: defaultUnitId,
			preview: {},
		});
	}

	function removeRow(key: string) {
		const i = components.findIndex((c) => c.key === key);
		if (i !== -1) components.splice(i, 1);
		delete openRows[key];
		delete amountRaw[key];
	}

	function applyProduct(key: string, hit: FoodDocument) {
		const c = components.find((x) => x.key === key);
		if (!c) return;
		c.productId = hit.id;
		c.subRecipeId = null;
		c.name = hit.namePl ?? hit.nameEn;
		c.categorySlug = hit.categorySlug;
		// Per-100g nutrients + the conversion inputs all come straight off the hit (tagname-keyed,
		// no remap). The search doc now carries density/piece-weight (omitted when null, which the
		// `?? null` preserves), so the LIVE preview resolves grams with the SAME inputs the server
		// caches on save — a VOLUME row no longer shows a confident density-1.0 figure that the
		// save then silently overwrites, and a COUNT row resolves whenever a piece-weight exists.
		c.preview = {
			nutrientsPer100g: hit.nutrients,
			densityGPerMl: hit.densityGPerMl ?? null,
			pieceWeightG: hit.pieceWeightG ?? null,
		};
	}

	// Per-row monotonic token: a fast re-pick into the same row fires a second fetch; only the
	// latest one may apply (mirrors ProductPicker's `++token` guard), so an out-of-order response
	// can never overwrite a newer preview. A plain (non-reactive) record — it's never read in the
	// template, only compared to gate the apply.
	const subRecipeFetchToken: Record<string, number> = {};

	async function applySubRecipe(key: string, hit: RecipeDocument) {
		const c = components.find((x) => x.key === key);
		if (!c) return;
		c.subRecipeId = hit.id;
		c.productId = null;
		c.name = hit.name;
		c.categorySlug = null;
		c.preview = {};
		const mine = (subRecipeFetchToken[key] ?? 0) + 1;
		subRecipeFetchToken[key] = mine;
		// Fetch the cached (totals, yieldWeightG) pair so the live panel can apportion the
		// sub-recipe's contribution by weight share (mirrors the server rollup). On a TRANSIENT
		// failure (network blip / 5xx) the preview would otherwise stay empty until a manual
		// re-pick: the rollup still flags the row incomplete (so the total is never shown as a
		// confident number), but it understates the live figure, so retry a few times with
		// backoff. A 4xx is permanent (don't retry); a newer pick into this row (token bump)
		// supersedes and aborts; the save recompute is authoritative regardless.
		for (let attempt = 0; attempt < 3; attempt++) {
			if (subRecipeFetchToken[key] !== mine) return; // superseded by a newer pick
			try {
				const res = await fetch(`/api/recipes/${hit.id}`);
				if (res.ok) {
					const d = (await res.json()) as RecipeDetailView;
					const cur = components.find((x) => x.key === key);
					if (cur && cur.subRecipeId === hit.id && subRecipeFetchToken[key] === mine) {
						cur.preview = {
							totals: d.nutrients,
							yieldWeightG: d.yieldWeightG,
							nutritionComplete: d.nutritionComplete,
						};
					}
					return;
				}
				if (res.status < 500) return; // 4xx is permanent — re-picking won't help
			} catch {
				// network error — fall through to retry
			}
			// Backoff before the next attempt (none after the last); skip if superseded meanwhile.
			if (attempt < 2 && subRecipeFetchToken[key] === mine) {
				await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
			}
		}
		// Retries exhausted — leave preview empty; the live panel flags the row incomplete.
	}

	// ─── Inline "create product" dialog (embeds the foods ProductForm) ───────────────
	let createRowKey = $state<string | null>(null);
	let createDraft = $state<DraftProduct | null>(null);
	let createSaving = $state(false);
	let createError = $state<string | null>(null);

	function openCreate(key: string, query: string) {
		createRowKey = key;
		const d = emptyDraft("CUSTOM");
		d.namePl = query;
		createDraft = d;
		createError = null;
	}
	function closeCreate() {
		if (createSaving) return;
		createRowKey = null;
		createDraft = null;
		createError = null;
	}
	function onCreateOpenChange(open: boolean) {
		if (!open) closeCreate();
	}

	async function handleCreateSubmit(draft: DraftProduct) {
		if (createSaving || createRowKey === null) return;
		createSaving = true;
		createError = null;
		try {
			const res = await fetch("/api/foods", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(draftToSavePayload(draft)),
			});
			let id: string | null = null;
			if (res.status === 201) {
				id = (await res.json()).id as string;
			} else if (res.status === 409) {
				// Same (source, sourceId) already saved — link the existing product instead.
				id = (await res.json()).existingId as string;
			}
			if (!id) {
				createError = t("add.saveError");
				return;
			}
			const c = components.find((x) => x.key === createRowKey);
			if (c) {
				const per100: Record<string, number> = {};
				for (const n of draft.nutrients) {
					if (n.amountPer100g !== null) per100[n.nutrientId] = n.amountPer100g;
				}
				c.productId = id;
				c.subRecipeId = null;
				c.name = draft.namePl?.trim() || draft.nameEn.trim();
				c.categorySlug = categories.find((cat) => cat.id === draft.categoryId)?.slug ?? null;
				c.preview = {
					nutrientsPer100g: per100,
					densityGPerMl: draft.densityGPerMl ?? null,
					pieceWeightG: draft.pieceWeightG ?? null,
				};
			}
			createSaving = false;
			createRowKey = null;
			createDraft = null;
		} catch {
			createError = t("add.saveError");
		} finally {
			createSaving = false;
		}
	}

	// ─── Drag reorder (grip is the draggable handle; rows are drop targets) ───────────
	let dragKey = $state<string | null>(null);
	function onDragStart(e: DragEvent, key: string) {
		dragKey = key;
		e.dataTransfer?.setData("text/plain", key);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
	}
	function onDrop(targetKey: string) {
		const from = dragKey;
		dragKey = null;
		if (from === null || from === targetKey) return;
		const fromIdx = components.findIndex((c) => c.key === from);
		const toIdx = components.findIndex((c) => c.key === targetKey);
		if (fromIdx === -1 || toIdx === -1) return;
		const [moved] = components.splice(fromIdx, 1);
		components.splice(toIdx, 0, moved);
	}
</script>

<div class="ings">
	{#each components as c (c.key)}
		<ComponentRow
			component={c}
			{units}
			amountValue={amountDisplay(c)}
			autoOpen={c.key === autoOpenKey}
			initialTab={autoOpenTab}
			dragging={dragKey === c.key}
			{excludeRecipeId}
			onAmountInput={(v) => onAmountInput(c.key, v)}
			onUnitChange={(id) => (c.unitId = id)}
			onRemove={() => removeRow(c.key)}
			onSelectProduct={(hit) => applyProduct(c.key, hit)}
			onSelectSubRecipe={(hit) => applySubRecipe(c.key, hit)}
			onCreateProduct={(query) => openCreate(c.key, query)}
			onPickerOpenChange={(o) => (openRows[c.key] = o)}
			onDragStart={(e) => onDragStart(e, c.key)}
			onDragEnd={() => (dragKey = null)}
			onDrop={() => onDrop(c.key)}
		/>
	{/each}
</div>

<div class="addbtns">
	<Button type="button" variant="secondary" size="sm" onclick={() => addRow("products")}>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
			><path
				d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z"
			/></svg
		>
		{t("recipe.form.addIngredient")}
	</Button>
	<Button type="button" variant="secondary" size="sm" onclick={() => addRow("subRecipes")}>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				d="M4 3.6A1.6 1.6 0 0 1 5.6 2H10v15.4l-.9-.5a3 3 0 0 0-1.5-.4H5.6A1.6 1.6 0 0 1 4 14.9V3.6Z"
			/><path
				d="M16 3.6A1.6 1.6 0 0 0 14.4 2H10v15.4l.9-.5a3 3 0 0 1 1.5-.4h2A1.6 1.6 0 0 0 16 14.9V3.6Z"
				opacity=".5"
			/>
		</svg>
		{t("recipe.form.addSubRecipe")}
	</Button>
</div>

<Dialog
	open={createDraft !== null}
	onOpenChange={onCreateOpenChange}
	title={t("recipe.form.createProduct")}
	closeLabel={t("common.cancel")}
	class="recipe-create-dialog"
>
	{#if createDraft}
		<ProductForm
			draft={createDraft}
			{registry}
			{categories}
			mode="create"
			saving={createSaving}
			errorMessage={createError}
			onSubmit={handleCreateSubmit}
			onCancel={closeCreate}
		/>
	{/if}
</Dialog>

<style>
	/* The embedded create-product dialog hosts the full ProductForm — widen past the default. */
	:global(.dialog-content.recipe-create-dialog) {
		width: min(560px, calc(100vw - 32px));
	}

	.ings {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.addbtns {
		display: flex;
		gap: 8px;
		margin-top: 13px;
		flex-wrap: wrap;
	}
</style>
