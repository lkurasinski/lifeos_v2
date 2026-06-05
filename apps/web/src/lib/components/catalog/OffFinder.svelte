<script lang="ts">
	import { isBarcodeQuery, type DraftProduct, type PreviewResult } from "$lib/food/schema";
	import { t } from "$lib/i18n";
	import { withRetry } from "$lib/retry";
	import CategoryIcon from "./CategoryIcon.svelte";
	import { draftDisplayName } from "./save-product";

	// The OFF "find" panel: one smart field (product name OR EAN barcode) → POST
	// /api/foods/off-preview (NO write) → a results list, plus the manual-entry escape
	// hatch and the guardrail note. Owns its own search/retry state; emits the picked
	// draft (or a clear) to the host route, which owns the editable preview pane.
	type Props = {
		/** True while the host shows the manual draft — dims this panel's result highlight. */
		manualActive: boolean;
		/** A non-existing result was picked (or `null` to clear the preview for a new search). */
		onSelect: (draft: DraftProduct | null) => void;
		/** "Dodaj ręcznie" — the host opens a blank CUSTOM draft. */
		onManual: () => void;
		/** An already-in-catalog result was clicked — the host routes to it instead of re-adding. */
		onExisting: () => void;
	};
	let { manualActive, onSelect, onManual, onExisting }: Props = $props();

	// OFF's CDN/proxy is intermittently flaky (transient TLS/network failures), so the
	// preview fetch auto-retries up to MAX_ATTEMPTS with a pause between tries, surfacing
	// the attempt count to the user. A 429 (rate limit) is NOT retried — that would only
	// make it worse — and a final failure after the last attempt shows the network error.
	const MAX_ATTEMPTS = 5;
	const RETRY_DELAY_MS = 1500;

	let query = $state("");
	const isBarcode = $derived(isBarcodeQuery(query));

	let loading = $state(false);
	// Which attempt is in flight (1..MAX) and whether we're past the first try — drives
	// the "ponawiam (N/5)" message.
	let attempt = $state(1);
	let retrying = $state(false);
	// Distinct preview states the UI renders differently.
	let view = $state<"idle" | "results" | "empty" | "network" | "rate">("idle");
	let results = $state<PreviewResult[]>([]);
	let selectedIndex = $state<number | null>(null);

	// One preview attempt: a rate-limit (429) is a terminal outcome (never retried), a
	// transport failure throws (so `withRetry` retries it), and a 2xx returns the hits.
	type PreviewOutcome = { kind: "rate" } | { kind: "results"; results: PreviewResult[] };
	async function fetchPreview(q: string): Promise<PreviewOutcome> {
		const res = await fetch("/api/foods/off-preview", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ query: q }),
		});
		if (res.status === 429) return { kind: "rate" };
		if (!res.ok) throw new Error("off_unavailable");
		const dataRes = (await res.json()) as { results: PreviewResult[] };
		return { kind: "results", results: dataRes.results ?? [] };
	}

	function applyOutcome(outcome: PreviewOutcome) {
		if (outcome.kind === "rate") {
			view = "rate";
			return;
		}
		results = outcome.results;
		if (results.length === 0) {
			view = "empty";
			return;
		}
		view = "results";
		// Auto-open the first editable (non-existing) result for review.
		const first = results.findIndex((r) => !r.existing);
		if (first !== -1) {
			selectedIndex = first;
			onSelect(results[first].draft);
		} else {
			selectedIndex = null;
		}
	}

	async function runPreview() {
		const q = query.trim();
		if (!q || loading) return;
		loading = true;
		// Clear the host's preview pane (and any manual draft) for the new search.
		onSelect(null);
		results = [];
		selectedIndex = null;
		attempt = 1;
		retrying = false;
		try {
			const outcome = await withRetry(() => fetchPreview(q), {
				attempts: MAX_ATTEMPTS,
				delayMs: RETRY_DELAY_MS,
				// Announce the upcoming attempt so the UI can show "ponawiam (N/5)".
				onRetry: (next) => {
					attempt = next;
					retrying = true;
				},
			});
			applyOutcome(outcome);
		} catch {
			// All attempts failed a transport error → the network state.
			view = "network";
		} finally {
			loading = false;
			retrying = false;
			attempt = 1;
		}
	}

	function onFinderKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			runPreview();
		}
	}

	function pickResult(index: number) {
		const r = results[index];
		if (!r) return;
		if (r.existing) {
			// Already in the catalog — let the host route to it rather than re-adding.
			onExisting();
			return;
		}
		selectedIndex = index;
		onSelect(r.draft);
	}
</script>

<div class="rounded-lg bg-card p-[18px] pb-4 shadow-soft">
	<h2 class="text-[1.0625rem] font-semibold tracking-[-0.01em] text-foreground">{t("add.findTitle")}</h2>
	<p class="mb-[15px] mt-[3px] text-xs leading-[1.45] text-muted-foreground">{t("add.findNote")}</p>

	<div class="flex gap-[9px]">
		<div class="relative flex-1">
			{#if isBarcode}
				<svg
					class="pointer-events-none absolute left-[13px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						d="M3 4.75A.75.75 0 0 1 3.75 4h.5a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V4.75Zm3 0A.75.75 0 0 1 6.75 4a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75.75.75 0 0 1-.75-.75V4.75Zm2.75 0A.75.75 0 0 1 9.5 4h1a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-1a.75.75 0 0 1-.75-.75V4.75Zm3.75 0A.75.75 0 0 1 13 4h.25a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H13a.75.75 0 0 1-.75-.75V4.75Z"
					/>
				</svg>
			{:else}
				<svg
					class="pointer-events-none absolute left-[13px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
						clip-rule="evenodd"
					/>
				</svg>
			{/if}
			<input
				type="text"
				class={[
					"w-full rounded-sm border bg-card py-[13px] pl-[38px] text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground focus:border-transparent focus:shadow-[var(--focus)]",
					isBarcode ? "pr-[92px]" : "pr-[14px]",
				]}
				bind:value={query}
				onkeydown={onFinderKeydown}
				placeholder={t("add.searchPlaceholder")}
				aria-label={t("add.searchAria")}
			/>
			{#if isBarcode}
				<span
					class="pointer-events-none absolute right-[7px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-pill bg-secondary px-[9px] py-[5px] text-[0.5625rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
				>
					{t("add.modeEan")}
				</span>
			{/if}
		</div>
		<button
			type="button"
			class="shrink-0 rounded-sm border-0 bg-primary px-[18px] text-[0.875rem] font-medium text-primary-foreground shadow-soft enabled:hover:shadow-lift disabled:cursor-default disabled:opacity-40"
			onclick={runPreview}
			disabled={loading || query.trim() === ""}
		>
			{loading ? t("add.searching") : t("add.searchButton")}
		</button>
	</div>

	{#if loading}
		<div class="mx-0.5 mb-1.5 mt-[18px] flex items-center gap-2.5 text-[0.8125rem] text-muted-foreground">
			<span class="spin" aria-hidden="true"></span>
			{#if retrying}
				<span>{t("add.retrying")} · {attempt}/{MAX_ATTEMPTS}</span>
			{:else}
				<span>{t("add.searching")}</span>
			{/if}
		</div>
	{:else if view === "results"}
		<div class="mx-0.5 mb-2 mt-4 flex items-center gap-[7px] text-[0.5625rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
			{t("add.resultsLabel")}<span class="ml-auto normal-case tracking-normal tabular-nums">{results.length}</span>
		</div>
		<div class="flex flex-col gap-1.5">
			{#each results as r, i (r.draft.sourceId ?? i)}
				<button
					type="button"
					class={[
						"flex w-full items-center gap-[11px] rounded-sm border-0 bg-transparent px-2.5 py-[9px] text-left focus-visible:shadow-[var(--focus)] focus-visible:outline-none",
						selectedIndex === i && !manualActive
							? "bg-card shadow-[var(--shadow-soft),inset_0_0_0_1px_var(--hairline)]"
							: "hover:bg-accent",
					]}
					onclick={() => pickResult(i)}
				>
					<span class="grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-[9px] bg-secondary">
						{#if r.draft.imageThumbUrl ?? r.draft.imageUrl}
							<img class="h-full w-full object-cover" src={r.draft.imageThumbUrl ?? r.draft.imageUrl} alt="" loading="lazy" />
						{:else}
							<CategoryIcon slug={null} size={18} />
						{/if}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-[0.875rem] font-[550] leading-[1.25] tracking-[-0.005em] text-foreground">{draftDisplayName(r.draft)}</span>
						{#if r.draft.brand}
							<span class="mt-px block truncate text-[0.6875rem] tabular-nums text-muted-foreground">{r.draft.brand}</span>
						{/if}
					</span>
					{#if r.existing}
						<span class="shrink-0 rounded-pill bg-secondary px-2 py-1 text-[0.5625rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{t("add.inCatalog")}</span>
					{/if}
				</button>
			{/each}
		</div>
	{:else if view === "empty"}
		<p class="mx-0.5 mb-1 mt-4 text-[0.8125rem] leading-[1.45] text-muted-foreground">{t("add.emptyResults")}</p>
	{:else if view === "network"}
		<p class="mx-0.5 mb-1 mt-4 text-[0.8125rem] leading-[1.45] text-destructive">{t("add.networkError")}</p>
	{:else if view === "rate"}
		<p class="mx-0.5 mb-1 mt-4 text-[0.8125rem] leading-[1.45] text-destructive">{t("add.rateLimitError")}</p>
	{/if}

	<!-- "albo" divider before the manual-entry escape hatch (rules drawn via .orline pseudo-elements). -->
	<div class="orline mx-0.5 mb-3 mt-[18px] flex items-center gap-3 text-[0.6875rem] tracking-[0.04em] text-muted-foreground">{t("add.or")}</div>
	<!-- Manual entry — opens a blank CUSTOM draft in the preview pane (probe `.manual`). -->
	<button
		type="button"
		class={[
			"flex w-full items-center gap-[11px] rounded-sm border-0 bg-card px-3 py-[11px] text-left hover:bg-accent focus-visible:shadow-[var(--focus)] focus-visible:outline-none",
			manualActive ? "shadow-[var(--shadow-soft),inset_0_0_0_1px_var(--hairline)]" : "shadow-soft",
		]}
		onclick={onManual}
	>
		<span class="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-secondary text-foreground">
			<svg class="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z"
				/>
			</svg>
		</span>
		<span class="flex min-w-0 flex-col gap-px">
			<span class="text-[0.875rem] font-semibold tracking-[-0.005em] text-foreground">{t("add.manualTitle")}</span>
			<span class="text-[0.6875rem] text-muted-foreground">{t("add.manualSub")}</span>
		</span>
	</button>

	<div class="mt-[14px] flex gap-[7px] border-t border-[color:var(--hairline)] pt-[13px] text-[0.6875rem] leading-[1.4] text-muted-foreground">
		<svg class="mt-px h-[14px] w-[14px] shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fill-rule="evenodd"
				d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"
				clip-rule="evenodd"
			/>
		</svg>
		<span>{t("add.guardrailNote")}</span>
	</div>
</div>

<style>
	/* Retry spinner — keyframe rotation kept as scoped CSS (hard to express as a utility). */
	.spin {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		border-radius: 50%;
		border: 2px solid var(--border);
		border-top-color: var(--foreground);
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation-duration: 1.6s;
		}
	}

	/* "albo" divider rules — pseudo-element lines flanking the label. */
	.orline::before,
	.orline::after {
		content: "";
		flex: 1;
		height: 1px;
		background: var(--hairline);
	}
</style>
