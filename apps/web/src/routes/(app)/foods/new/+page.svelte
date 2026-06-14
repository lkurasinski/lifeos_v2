<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { FormHeader } from "$lib/components/ui/form-header";
	import { DetailPlaceholder } from "$lib/components/ui/detail-placeholder";
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

<div class="min-h-svh">
	<FormHeader
		title={t("add.title")}
		onBack={toCatalog}
		backLabel={t("add.close")}
		onCancel={toCatalog}
		cancelLabel={t("common.cancel")}
	/>

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
				<DetailPlaceholder text={t("add.previewHint")} />
			{/if}
		</div>
	</div>
</div>

<style>
	/* Page-unique two-column flow (OFF finder + editable preview); collapses to one
	   column below the detail breakpoint. Shared chrome (header, preview placeholder)
	   is composed from the ui/ components above. */
	.flow {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 540px;
		gap: 20px;
		max-width: 1200px;
		margin-inline: auto;
		padding: 18px 24px 48px;
		align-items: start;
	}
	@media (max-width: 1199px) {
		.flow {
			grid-template-columns: minmax(0, 1fr);
			max-width: 640px;
		}
	}
	@media (max-width: 768px) {
		.flow {
			padding: 14px 16px 64px;
		}
	}
</style>
