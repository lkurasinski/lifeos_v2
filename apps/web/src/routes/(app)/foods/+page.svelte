<script lang="ts">
	import { goto, invalidateAll, pushState } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { MediaQuery } from "svelte/reactivity";
	import type { FoodDocument, FoodSource, SortKey } from "$lib/food/schema";
	import { t } from "$lib/i18n";
	import { Button } from "$lib/components/ui/button";
	import { Dialog } from "$lib/components/ui/dialog";
	import { toast } from "$lib/components/ui/sonner";
	import CatalogSearchBar from "$lib/components/catalog/CatalogSearchBar.svelte";
	import FacetChips from "$lib/components/catalog/FacetChips.svelte";
	import Pagination from "$lib/components/catalog/Pagination.svelte";
	import ProductDetail from "$lib/components/catalog/ProductDetail.svelte";
	import ProductTable from "$lib/components/catalog/ProductTable.svelte";
	import { segmentToSources, sourcesToSegment, type SourceSegment } from "$lib/components/catalog/meta";

	let { data } = $props();

	// Below 1200px the detail moves into a modal (freeing the list to show all columns).
	// Fallback `false` = desktop on the server, so SSR + first hydration agree.
	const modalMode = new MediaQuery("(max-width: 1199px)", false);

	// Search box is a controlled field; debounce keystrokes into URL navigation. The
	// URL is the single source of truth (SSR + shareable), but the box is local $state
	// so an in-flight navigation landing can't overwrite keystrokes typed while it was
	// running. We reconcile FROM the URL only on EXTERNAL changes (back/forward, facet
	// nav, clear) — never on the navigation our own typing triggered — guarded by the
	// `lastNavigated` value below.
	// Initial-value capture is intentional — the $effect below owns all later syncing.
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

	// Selection: desktop keeps it in component state for the inline panel; the modal
	// drives off shallow-routing page state so the browser back button (and ESC, via
	// the dialog) dismiss it. Nothing is shown until the user picks a row.
	let selectedId = $state<string | null>(null);

	// The add flow lives on its own route (/foods/new) so the browser back/forward
	// buttons work; saving there navigates back here and a fresh load surfaces the product.
	const modalDetailId = $derived(page.state.detailId ?? null);
	const highlightId = $derived(modalMode.current ? modalDetailId : selectedId);
	const inlineProduct = $derived(
		modalMode.current ? null : (data.result.hits.find((h) => h.id === selectedId) ?? null),
	);
	const modalProduct = $derived(
		modalMode.current && modalDetailId
			? (data.result.hits.find((h) => h.id === modalDetailId) ?? null)
			: null,
	);

	const totalLabel = $derived(new Intl.NumberFormat("pl-PL").format(data.result.total));
	const sourceSegment = $derived(sourcesToSegment(data.params.sources as FoodSource[] | undefined));
	const activeCategory = $derived(data.params.categories?.[0] ?? null);

	type NavState = {
		q?: string;
		sources?: FoodSource[];
		categories?: string[];
		sort: SortKey;
		dir: "asc" | "desc";
		page: number;
	};

	/** Build the catalog query string from a full param set, omitting defaults for clean links. */
	function buildQuery(s: NavState): string {
		const parts: string[] = [];
		if (s.q) parts.push(`q=${encodeURIComponent(s.q)}`);
		if (s.sources && s.sources.length > 0) parts.push(`sources=${s.sources.join(",")}`);
		if (s.categories && s.categories.length > 0)
			parts.push(`categories=${s.categories.map(encodeURIComponent).join(",")}`);
		if (s.sort !== "name") parts.push(`sort=${s.sort}`);
		if (s.dir !== "asc") parts.push(`dir=${s.dir}`);
		if (s.page > 1) parts.push(`page=${s.page}`);
		return parts.join("&");
	}

	function navigate(overrides: Partial<NavState>) {
		const current: NavState = {
			q: data.params.q,
			sources: data.params.sources as FoodSource[] | undefined,
			categories: data.params.categories,
			sort: data.params.sort,
			dir: data.params.dir,
			page: data.params.page,
		};
		const next = { ...current, ...overrides };
		// Record the query we're navigating with so the reconcile $effect skips this
		// navigation when it lands (and only re-syncs the box on external URL changes).
		lastNavigated = next.q ?? "";
		const qs = buildQuery(next);
		goto(resolve(qs ? `/foods?${qs}` : "/foods"), { keepFocus: true, noScroll: true });
	}

	let searchTimer: ReturnType<typeof setTimeout>;
	// Cancel a pending debounced navigation if the page unmounts mid-window.
	$effect(() => () => clearTimeout(searchTimer));
	function onSearchInput() {
		// Clear the category filter as the user types — a category + free-text query
		// easily yields an empty set (e.g. "beef" category + "eggs"); dropping the
		// category keeps the search productive.
		clearTimeout(searchTimer);
		searchTimer = setTimeout(
			() => navigate({ q: searchValue.trim() || undefined, categories: [], page: 1 }),
			250,
		);
	}
	function onClearSearch() {
		clearTimeout(searchTimer);
		navigate({ q: undefined, page: 1 });
	}

	function onSourceChange(segment: SourceSegment) {
		navigate({ sources: segmentToSources(segment), page: 1 });
	}
	function onCategoryChange(slug: string | null) {
		navigate({ categories: slug ? [slug] : [], page: 1 });
	}
	function onSort(key: SortKey) {
		// Same column → flip direction; new column → sensible default (name asc,
		// macros desc so the richest products surface first).
		const dir: "asc" | "desc" =
			data.params.sort === key ? (data.params.dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc";
		navigate({ sort: key, dir, page: 1 });
	}
	function onPage(nextPage: number) {
		navigate({ page: nextPage });
		// Page swaps should start at the top of the list, not mid-scroll.
		window.scrollTo({ top: 0, behavior: "smooth" });
	}
	function onSelect(id: string) {
		if (modalMode.current) {
			// Push a history entry so the browser back button closes the modal.
			pushState("", { detailId: id });
		} else {
			selectedId = id;
		}
	}
	function onModalOpenChange(open: boolean) {
		// ESC / overlay click → pop the pushed entry so back-button and dialog agree.
		if (!open && page.state.detailId) history.back();
	}

	// ─── Edit / delete ──────────────────────────────────────────────────────────
	// Edit routes to its own page (mirrors /foods/new). Delete is gated behind a confirm
	// Dialog; on success it de-indexes server-side, so a re-query drops the row.
	let pendingDelete = $state<FoodDocument | null>(null);
	let deleting = $state(false);

	function onEditProduct(hit: FoodDocument) {
		goto(resolve(`/foods/${hit.id}/edit`));
	}
	function onRequestDelete(hit: FoodDocument) {
		pendingDelete = hit;
	}
	function onConfirmOpenChange(open: boolean) {
		if (!open && !deleting) pendingDelete = null;
	}

	async function confirmDelete() {
		const target = pendingDelete;
		if (!target || deleting) return;
		deleting = true;
		const name = target.namePl ?? target.nameEn;
		try {
			const res = await fetch(`/api/foods/${target.id}`, { method: "DELETE" });
			// 404 means it's already gone — treat as success (the goal is "not in the catalog").
			if (!res.ok && res.status !== 404) {
				toast.error(t("catalog.deleteError"), { description: name });
				return;
			}
			toast.success(t("catalog.deleted"), { description: name });
			pendingDelete = null;
			selectedId = null;
			// Close the mobile modal (pop its history entry) before re-querying.
			if (page.state.detailId) history.back();
			await invalidateAll();
		} catch {
			toast.error(t("catalog.deleteError"), { description: name });
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>{t("catalog.title")} — {t("common.appName")}</title>
</svelte:head>

<div class="screen">
	<div class="topbar">
		<div class="bar">
			<div class="brand">
				<h1>{t("catalog.title")}</h1>
				<div class="sub">
					<b>{totalLabel}</b>
					{t("catalog.productsCount")} · {t("catalog.per100g")}
				</div>
			</div>
			<CatalogSearchBar
				bind:value={searchValue}
				placeholder={t("catalog.searchPlaceholder")}
				oninput={onSearchInput}
				onclear={onClearSearch}
			/>
			<Button class="addbtn" onclick={() => goto(resolve("/foods/new"))}>
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z"
					/>
				</svg>
				{t("add.openButton")}
			</Button>
		</div>
	</div>

	<div class="toolbar">
		<FacetChips
			{sourceSegment}
			{onSourceChange}
			categories={data.categories}
			counts={data.result.facets.categorySlug}
			{activeCategory}
			{onCategoryChange}
		/>
	</div>

	<div class="grid">
		<div class="listcol">
			{#if data.result.hits.length === 0}
				<div class="empty">
					<p class="et">{t("catalog.emptyTitle")}</p>
					<p class="ed">{t("catalog.emptyHint")}</p>
				</div>
			{:else}
				<ProductTable
					hits={data.result.hits}
					sort={data.params.sort}
					dir={data.params.dir}
					selectedId={highlightId}
					{onSort}
					{onSelect}
				/>
				<Pagination page={data.result.page} limit={data.result.limit} total={data.result.total} {onPage} />
			{/if}
		</div>

		{#if !modalMode.current}
			<div class="detailcol">
				{#if inlineProduct}
					<ProductDetail
						hit={inlineProduct}
						registry={data.registry}
						onEdit={onEditProduct}
						onDelete={onRequestDelete}
					/>
				{:else if data.result.hits.length > 0}
					<div class="detail-empty">
						<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fill-rule="evenodd"
								d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
								clip-rule="evenodd"
							/>
						</svg>
						<p>{t("catalog.selectPrompt")}</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Below 1200px the detail opens in a modal (ESC + browser-back both close it). -->
<Dialog
	open={modalProduct !== null}
	onOpenChange={onModalOpenChange}
	title={modalProduct?.namePl ?? modalProduct?.nameEn ?? t("catalog.title")}
	closeLabel={t("catalog.closeDetail")}
>
	{#if modalProduct}
		<ProductDetail
			hit={modalProduct}
			registry={data.registry}
			embedded
			onEdit={onEditProduct}
			onDelete={onRequestDelete}
		/>
	{/if}
</Dialog>

<!-- Delete confirmation — destructive action gated behind an explicit confirm step. -->
<Dialog
	open={pendingDelete !== null}
	onOpenChange={onConfirmOpenChange}
	title={t("catalog.deleteConfirmTitle")}
	closeLabel={t("common.cancel")}
>
	{#if pendingDelete}
		<div class="confirm">
			<h2>{t("catalog.deleteConfirmTitle")}</h2>
			<p class="cmsg">{t("catalog.deleteConfirmBody")}</p>
			<p class="cname">{pendingDelete.namePl ?? pendingDelete.nameEn}</p>
			<div class="cactions">
				<Button variant="secondary" onclick={() => (pendingDelete = null)} disabled={deleting}>
					{t("common.cancel")}
				</Button>
				<Button variant="destructive" onclick={confirmDelete} disabled={deleting}>
					{deleting ? t("catalog.deleting") : t("common.delete")}
				</Button>
			</div>
		</div>
	{/if}
</Dialog>

<style>
	/* Constrain content width so the catalog doesn't sprawl on 4K displays: the glass
	   topbar spans the viewport, but its content — and the toolbar + grid — center in a
	   max-width column. */
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
		min-width: 5.5ch;
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
		grid-template-columns: minmax(0, 1fr) 416px;
		gap: 18px;
		max-width: var(--content-max);
		margin-inline: auto;
		padding: 14px 24px 40px;
		align-items: start;
	}
	.listcol {
		min-width: 0;
	}
	.detailcol {
		min-width: 0;
	}

	/* Placeholder before a product is selected — keeps the detail column from
	   collapsing on desktop and invites a pick. */
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

	/* Delete-confirmation dialog body. */
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

	/* Stack to a single column on mobile: the detail panel follows the list and stops
	   sticking, so a tap on a row scrolls into a full-width profile. */
	/* Below 1200px the detail is a modal, so the grid is a single full-width column. */
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
