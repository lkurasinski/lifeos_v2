<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { toast } from "$lib/components/ui/sonner";
	import OffFinder from "$lib/components/catalog/OffFinder.svelte";
	import ProductForm from "$lib/components/catalog/ProductForm.svelte";
	import { draftDisplayName, saveDraft } from "$lib/components/catalog/save-product";
	import { draftToSavePayload, emptyDraft, type DraftProduct } from "$lib/food/schema";
	import { t } from "$lib/i18n";

	// The add flow (human-in-the-loop) as a real route so the browser back/forward buttons
	// work. The left OffFinder owns the smart name/EAN search → NO-write preview; this route
	// owns the editable preview pane (the shared ProductForm) and the save round-trip. Manual
	// entry and a picked OFF draft both flow into the same pane and the same POST /api/foods.
	// On save / cancel the page navigates back to /foods (a fresh load surfaces the product).
	let { data } = $props();

	let saving = $state(false);
	let saveError = $state<string | null>(null);

	// What the preview pane shows: a picked OFF draft or a blank manual draft. `manualActive`
	// distinguishes the two (drives the finder highlight + cancel-label); `previewSeq` is the
	// remount key so the form re-seeds whenever the active draft changes.
	let previewDraft = $state<DraftProduct | null>(null);
	let manualActive = $state(false);
	let previewSeq = $state(0);

	function toCatalog() {
		goto(resolve("/foods"));
	}

	// An OFF result was picked (or cleared for a new search) — supersedes any manual draft.
	function selectDraft(draft: DraftProduct | null) {
		saveError = null;
		manualActive = false;
		previewDraft = draft;
		previewSeq++;
	}

	// "Dodaj ręcznie" — open a blank CUSTOM draft in the preview pane (server mints sourceId).
	function startManual() {
		saveError = null;
		manualActive = true;
		previewDraft = emptyDraft("CUSTOM");
		previewSeq++;
	}

	async function handleSubmit(draft: DraftProduct) {
		if (saving) return;
		saving = true;
		saveError = null;
		const name = draftDisplayName(draft);
		// 409 = same (source, sourceId) already saved → treat as the "special" outcome.
		const outcome = await saveDraft("/api/foods", "POST", draftToSavePayload(draft), 409);
		saving = false;
		if (outcome === "special") {
			// Already in the catalog — toast (the form unmounts on nav) + return.
			toast.info(t("add.alreadySaved"), { description: name });
			toCatalog();
		} else if (outcome === "error") {
			// Stays on the form for a retry; surface inline AND as a toast.
			saveError = t("add.saveError");
			toast.error(t("add.saveError"), { description: name });
		} else {
			// Success — confirm via toast, then a fresh load of /foods surfaces the product.
			toast.success(t("add.created"), { description: name });
			toCatalog();
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
			<OffFinder {manualActive} onSelect={selectDraft} onManual={startManual} onExisting={toCatalog} />
		</div>

		<div class="pv">
			{#if previewDraft}
				{#key previewSeq}
					<ProductForm
						draft={previewDraft}
						registry={data.registry}
						categories={data.categories}
						mode="create"
						{saving}
						errorMessage={saveError}
						onSubmit={handleSubmit}
						onCancel={toCatalog}
						cancelLabel={manualActive ? t("common.cancel") : t("add.reject")}
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
