<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { toast } from "$lib/components/ui/sonner";
	import CategoryIcon from "$lib/components/catalog/CategoryIcon.svelte";
	import ProductForm from "$lib/components/catalog/ProductForm.svelte";
	import {
		draftToSavePayload,
		isBarcodeQuery,
		type DraftProduct,
		type PreviewResult,
	} from "$lib/food/schema";
	import { t } from "$lib/i18n";

	// The OFF add flow (human-in-the-loop) as a real route so the browser back/forward
	// buttons work: one smart field accepts a product name OR an EAN barcode → POST
	// /api/foods/off-preview (NO write) → pick a result → edit in the shared ProductForm →
	// Save (POST /api/foods). An already-in-catalog result returns to the catalog instead
	// of re-adding. Per-state UI for empty / network / rate-limit. On save / cancel the
	// page navigates back to /foods (a fresh load surfaces the new product in the list).
	let { data } = $props();

	// OFF's CDN/proxy is intermittently flaky (transient TLS/network failures), so the
	// preview fetch auto-retries up to MAX_ATTEMPTS with a pause between tries, surfacing
	// the attempt count to the user. A 429 (rate limit) is NOT retried — that would only
	// make it worse — and a final failure after the last attempt shows the network error.
	const MAX_ATTEMPTS = 5;
	const RETRY_DELAY_MS = 1500;
	const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

	let saving = $state(false);
	let saveError = $state<string | null>(null);

	const selected = $derived(selectedIndex !== null ? (results[selectedIndex] ?? null) : null);
	// Only non-existing results open the editable preview; existing ones route instead.
	const selectedDraft = $derived(selected && !selected.existing ? selected.draft : null);

	function toCatalog() {
		goto(resolve("/foods"));
	}

	function resultName(d: DraftProduct): string {
		return d.namePl?.trim() || d.nameEn;
	}

	async function runPreview() {
		const q = query.trim();
		if (!q || loading) return;
		loading = true;
		saveError = null;
		results = [];
		selectedIndex = null;
		attempt = 1;
		retrying = false;
		try {
			for (let i = 1; i <= MAX_ATTEMPTS; i++) {
				try {
					const res = await fetch("/api/foods/off-preview", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ query: q }),
					});
					// Rate-limited: surface immediately, never retry (retrying only makes it worse).
					if (res.status === 429) {
						view = "rate";
						return;
					}
					// Network/transport failure (502) → throw to trigger a retry.
					if (!res.ok) throw new Error("off_unavailable");
					const dataRes = (await res.json()) as { results: PreviewResult[] };
					results = dataRes.results ?? [];
					if (results.length === 0) {
						view = "empty";
						return;
					}
					view = "results";
					// Auto-open the first editable (non-existing) result for review.
					selectedIndex = results.findIndex((r) => !r.existing);
					if (selectedIndex === -1) selectedIndex = null;
					return; // success — stop retrying
				} catch {
					if (i < MAX_ATTEMPTS) {
						// Announce the upcoming attempt, pause, then loop retries.
						attempt = i + 1;
						retrying = true;
						await sleep(RETRY_DELAY_MS);
					} else {
						// 5th attempt failed — resolve with the error message.
						view = "network";
					}
				}
			}
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
			// Already in the catalog — return to it rather than re-adding.
			toCatalog();
			return;
		}
		saveError = null;
		selectedIndex = index;
	}

	async function handleSubmit(draft: DraftProduct) {
		if (saving) return;
		saving = true;
		saveError = null;
		const payload = draftToSavePayload(draft);
		const name = resultName(draft);
		try {
			const res = await fetch("/api/foods", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (res.status === 409) {
				// Same (source, sourceId) already saved — toast (the form unmounts on nav) + return.
				toast.info(t("add.alreadySaved"), { description: name });
				toCatalog();
				return;
			}
			if (!res.ok) {
				// Stays on the form for a retry; surface inline AND as a toast.
				saveError = t("add.saveError");
				toast.error(t("add.saveError"), { description: name });
				return;
			}
			// Success — confirm via toast, then a fresh load of /foods surfaces the product.
			toast.success(t("add.created"), { description: name });
			toCatalog();
		} catch {
			saveError = t("add.saveError");
			toast.error(t("add.saveError"), { description: name });
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{t("add.title")} — {t("common.appName")}</title>
</svelte:head>

<div class="addscreen">
	<div class="addtop">
		<IconButton onclick={toCatalog} aria-label={t("add.close")}>
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M12.7 4.3a1 1 0 0 1 0 1.4L8.42 10l4.3 4.3a1 1 0 1 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z"
					clip-rule="evenodd"
				/>
			</svg>
		</IconButton>
		<h1>{t("add.title")}</h1>
		<button type="button" class="cancel" onclick={toCatalog}>{t("common.cancel")}</button>
	</div>

	<div class="flow">
		<div class="src">
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
							<button type="button" class="res" class:on={selectedIndex === i} onclick={() => pickResult(i)}>
								<span class="ri">
								{#if r.draft.imageThumbUrl ?? r.draft.imageUrl}
									<img class="rimg" src={r.draft.imageThumbUrl ?? r.draft.imageUrl} alt="" loading="lazy" />
								{:else}
									<CategoryIcon slug={null} size={18} />
								{/if}
							</span>
								<span class="rb">
									<span class="rn">{resultName(r.draft)}</span>
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
		</div>

		<div class="pv">
			{#if selectedDraft}
				{#key selectedIndex}
					<ProductForm
						draft={selectedDraft}
						registry={data.registry}
						categories={data.categories}
						mode="create"
						{saving}
						errorMessage={saveError}
						onSubmit={handleSubmit}
						onCancel={toCatalog}
						cancelLabel={t("add.reject")}
					/>
				{/key}
			{:else}
				<div class="pvhint">
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
							clip-rule="evenodd"
						/>
					</svg>
					<p>{t("add.previewHint")}</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.addscreen {
		min-height: 100svh;
	}

	.addtop {
		position: sticky;
		top: 0;
		z-index: 6;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 24px;
		background: var(--glass-fill-thick);
		backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		-webkit-backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		border-bottom: 1px solid var(--hairline);
	}
	.addtop h1 {
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--foreground);
	}
	.addtop .cancel {
		margin-left: auto;
		border: 0;
		background: transparent;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
	}
	.addtop .cancel:hover {
		background: var(--accent);
		color: var(--foreground);
	}

	.flow {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 540px;
		gap: 20px;
		max-width: 1200px;
		margin-inline: auto;
		padding: 18px 24px 48px;
		align-items: start;
	}

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

	.pvhint {
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
	.pvhint svg {
		width: 30px;
		height: 30px;
		opacity: 0.6;
	}
	.pvhint p {
		font-size: 0.875rem;
		max-width: 26ch;
	}

	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.addtop {
			background: var(--card);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.addtop {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--card);
		}
	}

	/* Single column below the detail breakpoint: finder first, then the preview. */
	@media (max-width: 1199px) {
		.flow {
			grid-template-columns: minmax(0, 1fr);
			max-width: 640px;
		}
	}
	@media (max-width: 768px) {
		.addtop {
			padding: 12px 16px;
		}
		.flow {
			padding: 14px 16px 64px;
		}
	}
</style>
