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

<div class="findpanel">
	<h2 class="srctitle">{t("add.findTitle")}</h2>
	<p class="srcnote">{t("add.findNote")}</p>

	<div class="finder">
		<div class="field" class:ean={isBarcode}>
			{#if isBarcode}
				<svg class="ic" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						d="M3 4.75A.75.75 0 0 1 3.75 4h.5a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V4.75Zm3 0A.75.75 0 0 1 6.75 4a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75.75.75 0 0 1-.75-.75V4.75Zm2.75 0A.75.75 0 0 1 9.5 4h1a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-1a.75.75 0 0 1-.75-.75V4.75Zm3.75 0A.75.75 0 0 1 13 4h.25a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H13a.75.75 0 0 1-.75-.75V4.75Z"
					/>
				</svg>
			{:else}
				<svg class="ic" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
						clip-rule="evenodd"
					/>
				</svg>
			{/if}
			<input
				type="text"
				bind:value={query}
				onkeydown={onFinderKeydown}
				placeholder={t("add.searchPlaceholder")}
				aria-label={t("add.searchAria")}
			/>
			{#if isBarcode}
				<span class="mode">{t("add.modeEan")}</span>
			{/if}
		</div>
		<button type="button" class="gobtn" onclick={runPreview} disabled={loading || query.trim() === ""}>
			{loading ? t("add.searching") : t("add.searchButton")}
		</button>
	</div>

	{#if loading}
		<div class="loadingbox">
			<span class="spin" aria-hidden="true"></span>
			{#if retrying}
				<span>{t("add.retrying")} · {attempt}/{MAX_ATTEMPTS}</span>
			{:else}
				<span>{t("add.searching")}</span>
			{/if}
		</div>
	{:else if view === "results"}
		<div class="reslab">{t("add.resultsLabel")}<span class="n">{results.length}</span></div>
		<div class="results">
			{#each results as r, i (r.draft.sourceId ?? i)}
				<button type="button" class="res" class:on={selectedIndex === i && !manualActive} onclick={() => pickResult(i)}>
					<span class="ri">
						{#if r.draft.imageThumbUrl ?? r.draft.imageUrl}
							<img class="rimg" src={r.draft.imageThumbUrl ?? r.draft.imageUrl} alt="" loading="lazy" />
						{:else}
							<CategoryIcon slug={null} size={18} />
						{/if}
					</span>
					<span class="rb">
						<span class="rn">{draftDisplayName(r.draft)}</span>
						{#if r.draft.brand}
							<span class="rm">{r.draft.brand}</span>
						{/if}
					</span>
					{#if r.existing}
						<span class="incat">{t("add.inCatalog")}</span>
					{/if}
				</button>
			{/each}
		</div>
	{:else if view === "empty"}
		<p class="statemsg">{t("add.emptyResults")}</p>
	{:else if view === "network"}
		<p class="statemsg err">{t("add.networkError")}</p>
	{:else if view === "rate"}
		<p class="statemsg err">{t("add.rateLimitError")}</p>
	{/if}

	<div class="orline">{t("add.or")}</div>
	<button type="button" class="manual" class:on={manualActive} onclick={onManual}>
		<span class="mi">
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z"
				/>
			</svg>
		</span>
		<span class="mb">
			<span class="mt">{t("add.manualTitle")}</span>
			<span class="ms">{t("add.manualSub")}</span>
		</span>
	</button>

	<div class="srcfoot">
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
	.findpanel {
		background: var(--card);
		border-radius: var(--radius);
		box-shadow: var(--shadow-soft);
		padding: 18px 18px 16px;
	}
	.srctitle {
		font-size: 1.0625rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--foreground);
	}
	.srcnote {
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--muted-foreground);
		margin: 3px 0 15px;
	}

	.finder {
		display: flex;
		gap: 9px;
	}
	.field {
		position: relative;
		flex: 1;
	}
	.field .ic {
		position: absolute;
		left: 13px;
		top: 50%;
		transform: translateY(-50%);
		width: 18px;
		height: 18px;
		color: var(--muted-foreground);
		pointer-events: none;
	}
	.field input {
		width: 100%;
		font-family: inherit;
		font-size: 0.9375rem;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 13px 14px 13px 38px;
		outline: none;
	}
	/* Reserve room for the "Kod EAN" chip only when it's shown. */
	.field.ean input {
		padding-right: 92px;
	}
	.field input::placeholder {
		color: var(--muted-foreground);
	}
	.field input:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.mode {
		position: absolute;
		right: 7px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		background: var(--secondary);
		padding: 5px 9px;
		border-radius: var(--pill);
		pointer-events: none;
		white-space: nowrap;
	}
	.gobtn {
		flex-shrink: 0;
		border: 0;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		padding: 0 18px;
		border-radius: var(--radius-sm);
		background: var(--primary);
		color: var(--primary-foreground);
		box-shadow: var(--shadow-soft);
	}
	.gobtn:hover:not(:disabled) {
		box-shadow: var(--shadow-lift);
	}
	.gobtn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.reslab {
		font-size: 0.5625rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin: 16px 2px 8px;
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.reslab .n {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		text-transform: none;
		letter-spacing: 0;
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.res {
		display: flex;
		align-items: center;
		gap: 11px;
		width: 100%;
		text-align: left;
		border: 0;
		cursor: pointer;
		background: transparent;
		border-radius: var(--radius-sm);
		padding: 9px 10px;
		font-family: inherit;
	}
	.res:hover {
		background: var(--accent);
	}
	.res.on {
		background: var(--card);
		box-shadow: var(--shadow-soft), inset 0 0 0 1px var(--hairline);
	}
	.res:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}
	.res .ri {
		width: 34px;
		height: 34px;
		border-radius: 9px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: var(--secondary);
		overflow: hidden;
	}
	.res .ri .rimg {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.res .rb {
		min-width: 0;
		flex: 1;
	}
	.res .rn {
		display: block;
		font-size: 0.875rem;
		font-weight: 550;
		letter-spacing: -0.005em;
		line-height: 1.25;
		color: var(--foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.res .rm {
		display: block;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
		margin-top: 1px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.res .incat {
		flex-shrink: 0;
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		background: var(--secondary);
		padding: 4px 8px;
		border-radius: var(--pill);
	}

	.loadingbox {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 18px 2px 6px;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
	}
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

	.statemsg {
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--muted-foreground);
		margin: 16px 2px 4px;
	}
	.statemsg.err {
		color: var(--destructive);
	}

	/* "albo" divider before the manual-entry escape hatch. */
	.orline {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 18px 2px 12px;
		font-size: 0.6875rem;
		letter-spacing: 0.04em;
		color: var(--muted-foreground);
	}
	.orline::before,
	.orline::after {
		content: "";
		flex: 1;
		height: 1px;
		background: var(--hairline);
	}
	/* Manual entry — opens a blank CUSTOM draft in the preview pane (probe `.manual`). */
	.manual {
		display: flex;
		align-items: center;
		gap: 11px;
		width: 100%;
		text-align: left;
		border: 0;
		cursor: pointer;
		background: var(--card);
		box-shadow: var(--shadow-soft);
		border-radius: var(--radius-sm);
		padding: 11px 12px;
		font-family: inherit;
	}
	.manual:hover {
		background: var(--accent);
	}
	.manual:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}
	.manual.on {
		box-shadow: var(--shadow-soft), inset 0 0 0 1px var(--hairline);
	}
	.manual .mi {
		width: 34px;
		height: 34px;
		border-radius: 9px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: var(--secondary);
		color: var(--foreground);
	}
	.manual .mi svg {
		width: 18px;
		height: 18px;
	}
	.manual .mb {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.manual .mt {
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--foreground);
	}
	.manual .ms {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
	}

	.srcfoot {
		font-size: 0.6875rem;
		line-height: 1.4;
		color: var(--muted-foreground);
		margin-top: 14px;
		padding-top: 13px;
		border-top: 1px solid var(--hairline);
		display: flex;
		gap: 7px;
	}
	.srcfoot svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		margin-top: 1px;
	}
</style>
