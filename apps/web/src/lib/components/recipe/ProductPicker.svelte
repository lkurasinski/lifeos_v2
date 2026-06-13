<script lang="ts">
	import { untrack } from "svelte";
	import CategoryIcon from "$lib/components/catalog/CategoryIcon.svelte";
	import type { FoodDocument } from "$lib/food/schema";
	import type { RecipeDocument } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import { formatAmount } from "./meta";

	// The combobox for one component row (locked by `form.html`): a picker button that, when
	// open, drops a popover with `Produkty`/`Pod-przepisy` tabs, a typeahead, results, and a
	// `Utwórz produkt „…"` affordance. It only SEARCHES — picking/creating is delegated upward so
	// `ComponentEditor` centralizes row assembly (incl. the sub-recipe detail fetch). Outside
	// click / Escape close it; a freshly added row opens via `autoOpen`.
	type Selection = { name: string; categorySlug: string | null; isSubRecipe: boolean } | null;

	type Props = {
		selection: Selection;
		initialTab?: "products" | "subRecipes";
		autoOpen?: boolean;
		/** Sub-recipe id to drop from results (the recipe being edited can't nest itself). */
		excludeRecipeId?: string;
		onSelectProduct: (hit: FoodDocument) => void;
		onSelectSubRecipe: (hit: RecipeDocument) => void;
		onCreateProduct: (query: string) => void;
		/** Reports open/close so the host can lift its section above sibling glass panels. */
		onOpenChange?: (open: boolean) => void;
	};

	let {
		selection,
		initialTab = "products",
		autoOpen = false,
		excludeRecipeId,
		onSelectProduct,
		onSelectSubRecipe,
		onCreateProduct,
		onOpenChange,
	}: Props = $props();

	let open = $state(untrack(() => autoOpen));

	// Surface open/close upward (the popover escapes its glass-panel stacking context only if
	// the host raises that panel's z-index while a picker is open).
	$effect(() => {
		onOpenChange?.(open);
	});
	let tab = $state<"products" | "subRecipes">(untrack(() => initialTab));
	let query = $state("");
	let products = $state<FoodDocument[]>([]);
	let recipes = $state<RecipeDocument[]>([]);
	let loading = $state(false);
	let rootEl: HTMLElement | undefined = $state();
	let searchEl: HTMLInputElement | undefined = $state();

	function toggle() {
		open = !open;
	}

	// Focus the search field when the popover opens (incl. the auto-opened fresh row).
	$effect(() => {
		if (open) searchEl?.focus();
	});

	// Debounced typeahead → /api/foods or /api/recipes (8 hits). A token guards against a
	// slow earlier response overwriting a newer one. Empty query clears the list.
	let token = 0;
	$effect(() => {
		const q = query.trim();
		const activeTab = tab;
		if (!open) return;
		const mine = ++token;
		if (q === "") {
			products = [];
			recipes = [];
			loading = false;
			return;
		}
		loading = true;
		const timer = setTimeout(async () => {
			try {
				if (activeTab === "products") {
					const res = await fetch(`/api/foods?q=${encodeURIComponent(q)}&limit=8`);
					const data = res.ok ? ((await res.json()) as { hits: FoodDocument[] }) : { hits: [] };
					if (mine === token) products = data.hits;
				} else {
					const res = await fetch(`/api/recipes?q=${encodeURIComponent(q)}&limit=8&scope=wszystkie`);
					const data = res.ok ? ((await res.json()) as { hits: RecipeDocument[] }) : { hits: [] };
					if (mine === token) recipes = data.hits.filter((r) => r.id !== excludeRecipeId);
				}
			} catch {
				if (mine === token) {
					products = [];
					recipes = [];
				}
			} finally {
				if (mine === token) loading = false;
			}
		}, 220);
		return () => clearTimeout(timer);
	});

	// Close on outside pointer / Escape.
	$effect(() => {
		if (!open) return;
		const onPointer = (e: PointerEvent) => {
			if (rootEl && !rootEl.contains(e.target as Node)) open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") open = false;
		};
		document.addEventListener("pointerdown", onPointer, true);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointer, true);
			document.removeEventListener("keydown", onKey);
		};
	});

	const SOURCE_LABEL: Record<string, string> = {
		USDA_SR: "USDA",
		USDA_FOUNDATION: "USDA",
		OFF: "OFF",
		CUSTOM: t("catalog.sourceBadge.custom"),
	};

	function productMeta(hit: FoodDocument): string {
		const parts = [SOURCE_LABEL[hit.source] ?? hit.source];
		if (hit.energyKcal !== undefined) parts.push(`${formatAmount(hit.energyKcal)} kcal / 100 g`);
		if (hit.brand) parts.push(hit.brand);
		return parts.join(" · ");
	}
	function recipeMeta(hit: RecipeDocument): string {
		const parts: string[] = [];
		if (hit.energyKcalPerServing !== undefined)
			parts.push(`${formatAmount(hit.energyKcalPerServing)} ${t("recipe.form.kcalPerServing")}`);
		parts.push(`${hit.servings} ${t("recipe.detail.servings")}`);
		return parts.join(" · ");
	}

	function pickProduct(hit: FoodDocument) {
		onSelectProduct(hit);
		open = false;
		query = "";
	}
	function pickRecipe(hit: RecipeDocument) {
		onSelectSubRecipe(hit);
		open = false;
		query = "";
	}
	function create() {
		onCreateProduct(query.trim());
		open = false;
	}
</script>

<span class="picker" bind:this={rootEl}>
	<button type="button" class="picker-btn" class:open onclick={toggle}>
		{#if selection}
			<span class="pic">
				{#if selection.isSubRecipe}
					<svg class="nest" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path d="M4 3.6A1.6 1.6 0 0 1 5.6 2H10v15.4l-.9-.5a3 3 0 0 0-1.5-.4H5.6A1.6 1.6 0 0 1 4 14.9V3.6Z" />
						<path d="M16 3.6A1.6 1.6 0 0 0 14.4 2H10v15.4l.9-.5a3 3 0 0 1 1.5-.4h2A1.6 1.6 0 0 0 16 14.9V3.6Z" opacity=".5" />
					</svg>
				{:else}
					<CategoryIcon slug={selection.categorySlug} size={14} />
				{/if}
			</span>
			<span class="pn">{selection.name}</span>
			{#if selection.isSubRecipe}
				<span class="nesttag">{t("recipe.form.subRecipeTag")}</span>
			{/if}
		{:else}
			<span class="pic">
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd" />
				</svg>
			</span>
			<span class="pn ph">{t("recipe.form.pickerPlaceholder")}</span>
		{/if}
		<svg class="chev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 13.5l-4.5-5h9z" /></svg>
	</button>

	{#if open}
		<div class="picker-pop">
			<div class="pp-tabs">
				<button type="button" class:on={tab === "products"} onclick={() => (tab = "products")}>{t("recipe.form.tabProducts")}</button>
				<button type="button" class:on={tab === "subRecipes"} onclick={() => (tab = "subRecipes")}>{t("recipe.form.tabSubRecipes")}</button>
			</div>
			<div class="pp-search">
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd" /></svg>
				<input
					bind:this={searchEl}
					bind:value={query}
					type="text"
					placeholder={tab === "products" ? t("recipe.form.pickerSearchProduct") : t("recipe.form.pickerSearchSubRecipe")}
					aria-label={tab === "products" ? t("recipe.form.pickerSearchProduct") : t("recipe.form.pickerSearchSubRecipe")}
				/>
			</div>

			{#if tab === "products"}
				<div class="pp-lab">{t("recipe.form.matchingProducts")}</div>
				{#if loading}
					<div class="pp-empty">{t("recipe.form.pickerSearching")}</div>
				{:else}
					{#each products as hit (hit.id)}
						<button type="button" class="pp-res" onclick={() => pickProduct(hit)}>
							<span class="ri"><CategoryIcon slug={hit.categorySlug} size={17} /></span>
							<span class="rb">
								<span class="rn">{hit.namePl ?? hit.nameEn}</span>
								<span class="rm2">{productMeta(hit)}</span>
							</span>
						</button>
					{:else}
						{#if query.trim()}<div class="pp-empty">{t("recipe.form.pickerEmpty")}</div>{/if}
					{/each}
				{/if}
				{#if query.trim()}
					<div class="pp-div"></div>
					<button type="button" class="pp-create" onclick={create}>
						<span class="ci">
							<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z" /></svg>
						</span>
						<span class="cc">
							<span class="ct">{t("recipe.form.createProduct")} „{query.trim()}"</span>
							<span class="cs">{t("recipe.form.createProductHint")}</span>
						</span>
					</button>
				{/if}
			{:else}
				<div class="pp-lab">{t("recipe.form.matchingSubRecipes")}</div>
				{#if loading}
					<div class="pp-empty">{t("recipe.form.pickerSearching")}</div>
				{:else}
					{#each recipes as hit (hit.id)}
						<button type="button" class="pp-res" onclick={() => pickRecipe(hit)}>
							<span class="ri">
								<svg class="nest" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
									<path d="M4 3.6A1.6 1.6 0 0 1 5.6 2H10v15.4l-.9-.5a3 3 0 0 0-1.5-.4H5.6A1.6 1.6 0 0 1 4 14.9V3.6Z" />
									<path d="M16 3.6A1.6 1.6 0 0 0 14.4 2H10v15.4l.9-.5a3 3 0 0 1 1.5-.4h2A1.6 1.6 0 0 0 16 14.9V3.6Z" opacity=".5" />
								</svg>
							</span>
							<span class="rb">
								<span class="rn">{hit.name}</span>
								<span class="rm2">{recipeMeta(hit)}</span>
							</span>
						</button>
					{:else}
						{#if query.trim()}<div class="pp-empty">{t("recipe.form.pickerEmpty")}</div>{/if}
					{/each}
				{/if}
			{/if}
		</div>
	{/if}
</span>

<style>
	.picker {
		position: relative;
		min-width: 0;
		display: block;
	}
	.picker-btn {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 9px;
		font-family: inherit;
		font-size: 0.875rem;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 9px 11px;
		cursor: pointer;
		text-align: left;
	}
	.picker-btn:hover {
		border-color: var(--muted-foreground);
	}
	.picker-btn.open {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.picker-btn .pic {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		background: var(--secondary);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted-foreground);
	}
	.picker-btn .pic svg {
		width: 14px;
		height: 14px;
	}
	.picker-btn .pn {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.picker-btn .pn.ph {
		color: var(--muted-foreground);
	}
	.picker-btn .nesttag {
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		background: var(--accent);
		padding: 2px 7px;
		border-radius: var(--radius-pill);
		flex-shrink: 0;
	}
	.picker-btn .chev {
		width: 14px;
		height: 14px;
		color: var(--muted-foreground);
		flex-shrink: 0;
	}

	.picker-pop {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 7px);
		z-index: 40;
		border-radius: var(--radius);
		padding: 9px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: var(--card);
		box-shadow: var(--shadow-lift);
	}
	.pp-tabs {
		display: flex;
		background: var(--accent);
		border-radius: var(--radius-pill);
		padding: 3px;
	}
	.pp-tabs button {
		flex: 1;
		border: 0;
		background: transparent;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted-foreground);
		padding: 5px 12px;
		border-radius: var(--radius-pill);
		cursor: pointer;
	}
	.pp-tabs button.on {
		background: var(--card);
		color: var(--foreground);
		box-shadow: var(--shadow-soft);
	}
	.pp-search {
		position: relative;
	}
	.pp-search svg {
		position: absolute;
		left: 11px;
		top: 50%;
		transform: translateY(-50%);
		width: 15px;
		height: 15px;
		color: var(--muted-foreground);
	}
	.pp-search input {
		width: 100%;
		font-family: inherit;
		font-size: 0.875rem;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 9px 12px 9px 33px;
		outline: none;
	}
	.pp-search input:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.pp-lab {
		font-size: 0.5625rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		padding: 2px 4px;
	}
	.pp-empty {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		padding: 8px 9px;
	}
	.pp-res {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		text-align: left;
		border: 0;
		background: transparent;
		border-radius: var(--radius-sm);
		padding: 8px 9px;
		cursor: pointer;
	}
	.pp-res:hover {
		background: var(--accent);
	}
	.pp-res .ri {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--secondary);
		color: var(--muted-foreground);
	}
	.pp-res .ri .nest {
		width: 17px;
		height: 17px;
	}
	.pp-res .rb {
		flex: 1;
		min-width: 0;
	}
	.pp-res .rn {
		display: block;
		font-size: 0.875rem;
		font-weight: 550;
		letter-spacing: -0.005em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.pp-res .rm2 {
		display: block;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
		margin-top: 1px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.pp-div {
		height: 1px;
		background: var(--hairline);
		margin: 3px 2px;
	}
	.pp-create {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		text-align: left;
		border: 0;
		border-radius: var(--radius-sm);
		padding: 9px;
		cursor: pointer;
		background: var(--secondary);
		color: var(--foreground);
	}
	.pp-create:hover {
		background: var(--accent);
	}
	.pp-create .ci {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: var(--primary);
		color: var(--primary-foreground);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.pp-create .ci svg {
		width: 16px;
		height: 16px;
	}
	.pp-create .cc {
		min-width: 0;
	}
	.pp-create .ct {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.pp-create .cs {
		display: block;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
	}
</style>
