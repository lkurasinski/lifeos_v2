<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { FormHeader } from "$lib/components/ui/form-header";
	import { toast } from "$lib/components/ui/sonner";
	import ProductForm from "$lib/components/catalog/ProductForm.svelte";
	import { draftDisplayName, saveDraft } from "$lib/components/catalog/save-product";
	import { draftToPatchPayload, type DraftProduct } from "$lib/food/schema";
	import { t } from "$lib/i18n";

	// Edit any product (CUSTOM / OFF / USDA) via the shared ProductForm, prefilled from
	// the DB-loaded draft. Save → PATCH /api/foods/[id] → back to /foods (a fresh load
	// surfaces the change). The endpoint flags `userModified` for verified sources and
	// re-syncs Meili. A real route (not an overlay) so browser back/forward work.
	let { data } = $props();

	let saving = $state(false);
	let saveError = $state<string | null>(null);

	function toCatalog() {
		goto(resolve("/foods"));
	}

	async function handleSubmit(draft: DraftProduct) {
		if (saving) return;
		saving = true;
		saveError = null;
		const name = draftDisplayName(draft);
		// draftToPatchPayload drops the immutable source/sourceId AND keeps null amounts so
		// the server removes the rows of nutrients the user cleared (NULL = "no data",
		// distinct from a stored 0). 404 = the product vanished (deleted in another tab).
		const outcome = await saveDraft(`/api/foods/${data.id}`, "PATCH", draftToPatchPayload(draft), 404);
		saving = false;
		if (outcome === "special") {
			toast.error(t("edit.notFound"), { description: name });
			toCatalog();
		} else if (outcome === "error") {
			saveError = t("add.saveError");
			toast.error(t("add.saveError"), { description: name });
		} else {
			toast.success(t("edit.updated"), { description: name });
			toCatalog();
		}
	}
</script>

<svelte:head>
	<title>{t("edit.title")} — {t("common.appName")}</title>
</svelte:head>

<div class="min-h-svh">
	<FormHeader
		title={t("edit.title")}
		onBack={toCatalog}
		backLabel={t("add.close")}
		onCancel={toCatalog}
		cancelLabel={t("common.cancel")}
	/>

	<div class="flow">
		<ProductForm
			draft={data.draft}
			registry={data.registry}
			categories={data.categories}
			mode="edit"
			{saving}
			errorMessage={saveError}
			onSubmit={handleSubmit}
			onCancel={toCatalog}
		/>
	</div>
</div>

<style>
	/* The form is the whole screen here (no finder column) — center it in a readable
	   column. Shared chrome (the sticky header) is the FormHeader component above. */
	.flow {
		max-width: 640px;
		margin-inline: auto;
		padding: 18px 24px 48px;
	}
	@media (max-width: 768px) {
		.flow {
			padding: 14px 16px 64px;
		}
	}
</style>
