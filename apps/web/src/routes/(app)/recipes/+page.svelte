<script lang="ts">
	import { goto, invalidateAll, pushState } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { MediaQuery } from "svelte/reactivity";
	import type { RecipeDetailView, RecipeScope, RecipeSortKey } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import { Button } from "$lib/components/ui/button";
	import { Dialog } from "$lib/components/ui/dialog";
	import { toast } from "$lib/components/ui/sonner";
	import CatalogSearchBar from "$lib/components/catalog/CatalogSearchBar.svelte";
	import Pagination from "$lib/components/catalog/Pagination.svelte";
	import RecipeCard from "$lib/components/recipe/RecipeCard.svelte";
	import RecipeDetail from "$lib/components/recipe/RecipeDetail.svelte";
	import RecipeFacets, { type FacetDim } from "$lib/components/recipe/RecipeFacets.svelte";
	import { sortOptions, defaultSortDir, compareMealTypes } from "$lib/components/recipe/meta";

	let { data } = $props();

	// Below 1200px the detail moves into a modal (freeing the list to full width). Fallback
	// `false` = desktop on the server, so SSR + first hydration agree (mirrors /foods).
	const modalMode = new MediaQuery("(max-width: 1199px)", false);

	// ─── Search box (controlled; debounced into URL navigation) ─────────────────
	// svelte-ignore state_referenced_locally
	let searchValue = $state(data.params.q ?? "");
	// svelte-ignore state_referenced_locally
	let lastNavigated = data.params.q ?? "";
	$effect(() => {
		const committed = data.params.q ?? "";
		if (committed !== lastNavigated) {
			searchValue = committed;
			lastNavigated = committed;
		}
	});

	// ─── Reference data (loaded once by the layout) ─────────────────────────────
	const mealTypesSorted = $derived(
		[...data.taxonomies.mealTypes].sort((a, b) => compareMealTypes(a.slug, b.slug)),
	);
	const mealTypeLabels = $derived(
		Object.fromEntries(data.taxonomies.mealTypes.map((m) => [m.slug, m.namePl])),
	);
	const dietLabels = $derived(Object.fromEntries(data.taxonomies.diets.map((d) => [d.slug, d.namePl])));

	const active = $derived<Record<FacetDim, string[]>>({
		mealTypes: data.params.mealTypes ?? [],
		diets: data.params.diets ?? [],
		allergens: data.params.allergens ?? [],
		techniques: data.params.techniques ?? [],
		cuisines: data.params.cuisines ?? [],
		difficulties: data.params.difficulties ?? [],
	});

	const totalLabel = $derived(new Intl.NumberFormat("pl-PL").format(data.result.total));
	const isDraftScope = $derived(data.params.scope === "szkice");

	// ─── URL navigation ──────────────────────────────────────────────────────────
	type NavState = {
		q?: string;
		scope: RecipeScope;
		mealTypes: string[];
		diets: string[];
		allergens: string[];
		techniques: string[];
		cuisines: string[];
		difficulties: string[];
		sort: RecipeSortKey;
		dir: "asc" | "desc";
		page: number;
	};

	function current(): NavState {
		return {
			q: data.params.q,
			scope: data.params.scope,
			mealTypes: data.params.mealTypes ?? [],
			diets: data.params.diets ?? [],
			allergens: data.params.allergens ?? [],
			techniques: data.params.techniques ?? [],
			cuisines: data.params.cuisines ?? [],
			difficulties: data.params.difficulties ?? [],
			sort: data.params.sort,
			dir: data.params.dir,
			page: data.params.page,
		};
	}

	/** Build the catalog query string, omitting defaults for clean links. */
	function buildQuery(s: NavState): string {
		const parts: string[] = [];
		if (s.q) parts.push(`q=${encodeURIComponent(s.q)}`);
		if (s.scope !== "wszystkie") parts.push(`scope=${s.scope}`);
		const arr = (key: string, v: string[]) => {
			if (v.length > 0) parts.push(`${key}=${v.map(encodeURIComponent).join(",")}`);
		};
		arr("mealTypes", s.mealTypes);
		arr("diets", s.diets);
		arr("allergens", s.allergens);
		arr("techniques", s.techniques);
		arr("cuisines", s.cuisines);
		arr("difficulties", s.difficulties);
		if (s.sort !== "relevance") parts.push(`sort=${s.sort}`);
		if (s.dir !== "asc") parts.push(`dir=${s.dir}`);
		if (s.page > 1) parts.push(`page=${s.page}`);
		return parts.join("&");
	}

	function navigate(overrides: Partial<NavState>) {
		const next = { ...current(), ...overrides };
		lastNavigated = next.q ?? "";
		const qs = buildQuery(next);
		goto(resolve(qs ? `/recipes?${qs}` : "/recipes"), { keepFocus: true, noScroll: true });
	}

	let searchTimer: ReturnType<typeof setTimeout>;
	$effect(() => () => clearTimeout(searchTimer));
	function onSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => navigate({ q: searchValue.trim() || undefined, page: 1 }), 250);
	}
	function onClearSearch() {
		clearTimeout(searchTimer);
		navigate({ q: undefined, page: 1 });
	}

	function onScopeChange(scope: RecipeScope) {
		// A scope switch is a different universe of recipes — drop a desktop selection that
		// belongs to the old scope (pagination/sort deliberately keep the panel open).
		selectedId = null;
		navigate({ scope, page: 1 });
	}
	function onToggle(dim: FacetDim, value: string) {
		const cur = active[dim];
		const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
		navigate({ [dim]: next, page: 1 });
	}
	function onClear(dim: FacetDim) {
		navigate({ [dim]: [], page: 1 });
	}
	function onSort(key: RecipeSortKey) {
		const dir: "asc" | "desc" =
			data.params.sort === key ? (data.params.dir === "asc" ? "desc" : "asc") : defaultSortDir(key);
		navigate({ sort: key, dir, page: 1 });
	}
	function onPage(nextPage: number) {
		navigate({ page: nextPage });
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	// ─── Selection + async detail fetch ─────────────────────────────────────────
	// The card hit (RecipeDocument) is lean; the detail panel reads the full cached profile
	// from Postgres via GET /api/recipes/[id]. Desktop keeps selection in state (inline
	// panel); the modal drives off shallow-routing page state (browser back / ESC dismiss).
	let selectedId = $state<string | null>(null);
	let detail = $state<RecipeDetailView | null>(null);
	let detailLoading = $state(false);
	let detailToken = 0;

	const modalDetailId = $derived(page.state.recipeDetailId ?? null);
	const activeId = $derived(modalMode.current ? modalDetailId : selectedId);

	async function fetchDetail(id: string) {
		const token = ++detailToken;
		detailLoading = true;
		detail = null;
		try {
			const res = await fetch(`/api/recipes/${id}`);
			if (token !== detailToken) return;
			detail = res.ok ? ((await res.json()) as RecipeDetailView) : null;
		} catch {
			if (token === detailToken) detail = null;
		} finally {
			if (token === detailToken) detailLoading = false;
		}
	}

	$effect(() => {
		const id = activeId;
		if (id) {
			fetchDetail(id);
		} else {
			detailToken++;
			detail = null;
			detailLoading = false;
		}
	});

	function onSelect(id: string) {
		if (modalMode.current) {
			pushState("", { recipeDetailId: id });
		} else {
			selectedId = id;
		}
	}
	function onModalOpenChange(open: boolean) {
		if (!open && page.state.recipeDetailId) history.back();
	}

	// ─── Edit / delete ──────────────────────────────────────────────────────────
	let pendingDelete = $state<RecipeDetailView | null>(null);
	let deleting = $state(false);

	function onEditRecipe(r: RecipeDetailView) {
		// `/recipes/[id]/edit` lands in Phase 6 — not yet a typed route, so navigate by string.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`/recipes/${r.id}/edit`);
	}
	function onRequestDelete(r: RecipeDetailView) {
		pendingDelete = r;
	}
	function onConfirmOpenChange(open: boolean) {
		if (!open && !deleting) pendingDelete = null;
	}

	async function confirmDelete() {
		const target = pendingDelete;
		if (!target || deleting) return;
		deleting = true;
		try {
			const res = await fetch(`/api/recipes/${target.id}`, { method: "DELETE" });
			if (res.status === 409) {
				// Blocked: the recipe is in use as a sub-recipe. Surface the count, keep it.
				const bodyData = await res.json().catch(() => null);
				const count = Array.isArray(bodyData?.referencingIds) ? bodyData.referencingIds.length : 0;
				toast.error(t("recipe.delete.blocked"), {
					description: count > 0 ? `${count} ${t("recipe.detail.usedInRecipes")}` : undefined,
				});
				pendingDelete = null;
				return;
			}
			if (!res.ok && res.status !== 404) {
				toast.error(t("recipe.delete.error"), { description: target.name });
				return;
			}
			toast.success(t("recipe.delete.done"), { description: target.name });
			pendingDelete = null;
			selectedId = null;
			detail = null;
			if (page.state.recipeDetailId) history.back();
			await invalidateAll();
		} catch {
			toast.error(t("recipe.delete.error"), { description: target.name });
		} finally {
			deleting = false;
		}
	}

	const sorts = sortOptions();
</script>

<svelte:head>
	<title>{t("recipe.list.title")} — {t("common.appName")}</title>
</svelte:head>

<div class="screen">
	<div class="topbar">
		<div class="bar">
			<div class="brand">
				<h1>{t("recipe.list.title")}</h1>
				<div class="sub">
					<b>{totalLabel}</b>
					{t("recipe.list.recipesCount")} · {t("recipe.list.perServingBasis")}
				</div>
			</div>
			<CatalogSearchBar
				bind:value={searchValue}
				placeholder={t("recipe.list.searchPlaceholder")}
				oninput={onSearchInput}
				onclear={onClearSearch}
			/>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- /recipes/new lands in Phase 6 -->
			<Button class="addbtn" onclick={() => goto("/recipes/new")}>
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z" />
				</svg>
				{t("recipe.list.addButton")}
			</Button>
		</div>
	</div>

	<div class="toolbar">
		<RecipeFacets
			scope={data.params.scope}
			draftCount={data.draftCount}
			{onScopeChange}
			mealTypes={mealTypesSorted}
			diets={data.taxonomies.diets}
			allergens={data.taxonomies.allergens}
			techniques={data.taxonomies.techniques}
			cuisines={data.taxonomies.cuisines}
			facets={data.result.facets}
			{active}
			{onToggle}
			{onClear}
		/>
	</div>

	<div class="grid">
		<div class="listcol">
			{#if !isDraftScope}
				<div class="sortbar">
					<span class="sl">{t("recipe.sort.label")}</span>
					{#each sorts as opt (opt.key)}
						{@const on = data.params.sort === opt.key}
						<button type="button" class="sortopt" class:on onclick={() => onSort(opt.key)}>
							{opt.label}
							{#if on && opt.key !== "relevance"}
								<svg class="ar" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
									<path d={data.params.dir === "asc" ? "M10 6l3.5 4h-7z" : "M10 14l-3.5-4h7z"} />
								</svg>
							{/if}
						</button>
					{/each}
					<span class="rcount">{totalLabel} {t("recipe.list.recipesCount")}</span>
				</div>
			{/if}

			{#if data.result.hits.length === 0}
				<div class="empty">
					<p class="et">{isDraftScope ? t("recipe.list.emptyDraftsTitle") : t("recipe.list.emptyTitle")}</p>
					<p class="ed">{isDraftScope ? t("recipe.list.emptyDraftsHint") : t("recipe.list.emptyHint")}</p>
				</div>
			{:else}
				<div class="list">
					{#each data.result.hits as hit (hit.id)}
						<RecipeCard
							{hit}
							selected={activeId === hit.id}
							{mealTypeLabels}
							{dietLabels}
							{onSelect}
						/>
					{/each}
				</div>
				<Pagination page={data.result.page} limit={data.result.limit} total={data.result.total} {onPage} />
			{/if}
		</div>

		{#if !modalMode.current}
			<div class="detailcol">
				{#if detailLoading}
					<div class="detail-empty"><p>{t("common.loading")}</p></div>
				{:else if detail}
					<RecipeDetail
						recipe={detail}
						registry={data.registry}
						onEdit={detail.isOwner ? onEditRecipe : undefined}
						onDelete={detail.isOwner ? onRequestDelete : undefined}
					/>
				{:else if data.result.hits.length > 0}
					<div class="detail-empty">
						<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd" />
						</svg>
						<p>{t("recipe.list.selectPrompt")}</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Below 1200px the detail opens in a modal (ESC + browser-back both close it). -->
<Dialog
	open={modalMode.current && modalDetailId !== null}
	onOpenChange={onModalOpenChange}
	title={detail?.name ?? t("recipe.list.title")}
	closeLabel={t("recipe.detail.close")}
>
	{#if detailLoading}
		<div class="modal-loading">{t("common.loading")}</div>
	{:else if detail}
		<RecipeDetail
			recipe={detail}
			registry={data.registry}
			embedded
			onEdit={detail.isOwner ? onEditRecipe : undefined}
			onDelete={detail.isOwner ? onRequestDelete : undefined}
		/>
	{/if}
</Dialog>

<!-- Delete confirmation — destructive action gated behind an explicit confirm step. -->
<Dialog
	open={pendingDelete !== null}
	onOpenChange={onConfirmOpenChange}
	title={t("recipe.delete.confirmTitle")}
	closeLabel={t("common.cancel")}
>
	{#if pendingDelete}
		<div class="confirm">
			<h2>{t("recipe.delete.confirmTitle")}</h2>
			<p class="cmsg">{t("recipe.delete.confirmBody")}</p>
			<p class="cname">{pendingDelete.name}</p>
			<div class="cactions">
				<Button variant="secondary" onclick={() => (pendingDelete = null)} disabled={deleting}>
					{t("common.cancel")}
				</Button>
				<Button variant="destructive" onclick={confirmDelete} disabled={deleting}>
					{deleting ? t("recipe.delete.deleting") : t("common.delete")}
				</Button>
			</div>
		</div>
	{/if}
</Dialog>

<style>
	.screen {
		--content-max: 1600px;
		min-height: 100svh;
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 6;
		padding: 18px 24px;
		background: var(--glass-fill-thick);
		backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		-webkit-backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		border-bottom: 1px solid var(--hairline);
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 20px;
		max-width: var(--content-max);
		margin-inline: auto;
	}
	.brand {
		flex-shrink: 0;
	}
	:global(.addbtn) {
		flex-shrink: 0;
	}
	.brand h1 {
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--foreground);
	}
	.brand .sub {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
		margin-top: 1px;
	}
	.brand .sub b {
		display: inline-block;
		min-width: 3ch;
		color: var(--foreground);
		font-weight: 500;
	}

	.toolbar {
		max-width: var(--content-max);
		margin-inline: auto;
		padding: 16px 24px 4px;
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 452px;
		gap: 18px;
		max-width: var(--content-max);
		margin-inline: auto;
		padding: 14px 24px 40px;
		align-items: start;
	}
	.listcol,
	.detailcol {
		min-width: 0;
	}

	.sortbar {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 2px 6px 12px;
		flex-wrap: wrap;
	}
	.sortbar .sl {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-right: 7px;
	}
	.sortopt {
		border: 0;
		background: transparent;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 5px 11px;
		border-radius: var(--pill);
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.sortopt:hover {
		color: var(--foreground);
		background: var(--accent);
	}
	.sortopt:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}
	.sortopt.on {
		color: var(--foreground);
		background: var(--secondary);
		font-weight: 600;
	}
	.sortopt .ar {
		width: 12px;
		height: 12px;
	}
	.sortbar .rcount {
		margin-left: auto;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.detail-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-height: 320px;
		padding: 32px;
		text-align: center;
		color: var(--muted-foreground);
		border: 1px dashed var(--hairline);
		border-radius: var(--radius);
	}
	.detail-empty svg {
		width: 30px;
		height: 30px;
		opacity: 0.6;
	}
	.detail-empty p {
		font-size: 0.875rem;
		max-width: 24ch;
	}
	.modal-loading {
		padding: 40px 24px;
		text-align: center;
		color: var(--muted-foreground);
		font-size: 0.875rem;
	}

	.confirm {
		padding: 26px 24px 22px;
	}
	.confirm h2 {
		font-size: 1.125rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--foreground);
	}
	.confirm .cmsg {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--muted-foreground);
		margin-top: 8px;
	}
	.confirm .cname {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--foreground);
		margin-top: 12px;
		padding: 10px 12px;
		background: var(--secondary);
		border-radius: var(--radius-sm);
		word-break: break-word;
	}
	.confirm .cactions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 22px;
	}

	.empty {
		padding: 64px 24px;
		text-align: center;
	}
	.empty .et {
		font-size: 1rem;
		font-weight: 550;
		color: var(--foreground);
	}
	.empty .ed {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin-top: 6px;
	}

	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.topbar {
			background: var(--card);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.topbar {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--card);
		}
	}

	@media (max-width: 1199px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 768px) {
		.bar {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}
		.toolbar {
			padding: 14px 16px 4px;
		}
		.grid {
			padding: 12px 16px 40px;
		}
	}
</style>
