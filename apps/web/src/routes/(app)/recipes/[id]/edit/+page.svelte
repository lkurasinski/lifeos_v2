<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { FormHeader } from "$lib/components/ui/form-header";
	import { ConfirmDialog } from "$lib/components/ui/confirm-dialog";
	import { toast } from "$lib/components/ui/sonner";
	import RecipeForm from "$lib/components/recipe/RecipeForm.svelte";
	import { recipeDraftToSavePayload, type RecipeDraft } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";

	// Edit a recipe via the shared `RecipeForm`, prefilled from the DB-loaded draft. Save → PATCH
	// /api/recipes/[id] (the server recomputes the cache, fans out to dependents, re-syncs Meili)
	// → back to /recipes. Delete is gated behind a confirm and surfaces the in-use (409) block.
	let { data } = $props();

	let saving = $state(false);
	let saveError = $state<string | null>(null);

	function toCatalog() {
		goto(resolve("/recipes"));
	}

	async function handleSubmit(d: RecipeDraft) {
		if (saving) return;
		saving = true;
		saveError = null;
		try {
			const res = await fetch(`/api/recipes/${data.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(recipeDraftToSavePayload(d)),
			});
			if (res.ok) {
				toast.success(t("recipe.form.updated"), { description: d.name });
				// Refresh the cached section layout so any custom taxonomy created on save lands
				// in the taxonomy options (otherwise its chip can't render on the next edit).
				await invalidateAll();
				toCatalog();
				return;
			}
			if (res.status === 409) {
				const body = await res.json().catch(() => null);
				saveError =
					body?.error === "depth" ? t("recipe.form.depthError") : t("recipe.form.cycleError");
				return;
			}
			if (res.status === 404) {
				saveError = t("recipe.form.notFound");
				return;
			}
			saveError = t("recipe.form.saveError");
		} catch {
			saveError = t("recipe.form.saveError");
		} finally {
			saving = false;
		}
	}

	// ─── Delete (with confirm + in-use block) ───────────────────────────────────────
	let confirmOpen = $state(false);
	let deleting = $state(false);

	function requestDelete() {
		confirmOpen = true;
	}
	function onConfirmOpenChange(open: boolean) {
		if (!open && !deleting) confirmOpen = false;
	}

	async function confirmDelete() {
		if (deleting) return;
		deleting = true;
		try {
			const res = await fetch(`/api/recipes/${data.id}`, { method: "DELETE" });
			if (res.status === 409) {
				const body = await res.json().catch(() => null);
				const count = Array.isArray(body?.referencingIds) ? body.referencingIds.length : 0;
				toast.error(t("recipe.delete.blocked"), {
					description: count > 0 ? `${count} ${t("recipe.detail.usedInRecipes")}` : undefined,
				});
				confirmOpen = false;
				return;
			}
			if (!res.ok && res.status !== 404) {
				toast.error(t("recipe.delete.error"), { description: data.draft.name });
				return;
			}
			toast.success(t("recipe.delete.done"), { description: data.draft.name });
			toCatalog();
		} catch {
			toast.error(t("recipe.delete.error"), { description: data.draft.name });
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>{t("recipe.form.editTitle")} — {t("common.appName")}</title>
</svelte:head>

<div class="min-h-svh">
	<FormHeader
		title={t("recipe.form.editTitle")}
		onBack={toCatalog}
		backLabel={t("common.back")}
		onCancel={toCatalog}
		cancelLabel={t("common.cancel")}
	/>

	{#key data.id}
		<RecipeForm
			draft={data.draft}
			taxonomies={data.taxonomies}
			units={data.units}
			registry={data.registry}
			categories={data.categories}
			mode="edit"
			excludeRecipeId={data.id}
			{saving}
			errorMessage={saveError}
			onSubmit={handleSubmit}
			onCancel={toCatalog}
			onDelete={requestDelete}
		/>
	{/key}
</div>

<ConfirmDialog
	open={confirmOpen}
	onOpenChange={onConfirmOpenChange}
	title={t("recipe.delete.confirmTitle")}
	message={t("recipe.delete.confirmBody")}
	subject={data.draft.name}
	confirmLabel={deleting ? t("recipe.delete.deleting") : t("common.delete")}
	cancelLabel={t("common.cancel")}
	onConfirm={confirmDelete}
	onCancel={() => (confirmOpen = false)}
	pending={deleting}
/>
