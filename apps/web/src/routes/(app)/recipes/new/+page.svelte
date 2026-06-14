<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { FormHeader } from "$lib/components/ui/form-header";
	import { toast } from "$lib/components/ui/sonner";
	import RecipeForm from "$lib/components/recipe/RecipeForm.svelte";
	import { emptyRecipeDraft, recipeDraftToSavePayload, type RecipeDraft } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";

	// Create a recipe via the shared `RecipeForm` (the authoring surface). The form owns its
	// editable draft + the live-nutrition panel; this route owns the save round-trip (POST
	// /api/recipes) and navigation. A real route (not an overlay) so browser back/forward work.
	// Reference data: units + categories from THIS load, taxonomies + registry from the layout.
	let { data } = $props();

	const draft = emptyRecipeDraft();
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
			const res = await fetch("/api/recipes", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(recipeDraftToSavePayload(d)),
			});
			if (res.status === 201) {
				toast.success(t("recipe.form.created"), { description: d.name });
				// Refresh the cached section layout so any custom taxonomy created on save lands
				// in the taxonomy options (otherwise its chip can't render when editing later).
				await invalidateAll();
				toCatalog();
				return;
			}
			if (res.status === 409) {
				const body = await res.json().catch(() => null);
				saveError =
					body?.error === "cycle"
						? t("recipe.form.cycleError")
						: body?.error === "depth"
							? t("recipe.form.depthError")
							: t("recipe.form.saveError");
				return;
			}
			saveError = t("recipe.form.saveError");
		} catch {
			saveError = t("recipe.form.saveError");
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{t("recipe.form.createTitle")} — {t("common.appName")}</title>
</svelte:head>

<div class="min-h-svh">
	<FormHeader
		title={t("recipe.form.createTitle")}
		onBack={toCatalog}
		backLabel={t("common.back")}
		onCancel={toCatalog}
		cancelLabel={t("common.cancel")}
	/>

	<RecipeForm
		{draft}
		taxonomies={data.taxonomies}
		units={data.units}
		registry={data.registry}
		categories={data.categories}
		mode="create"
		{saving}
		errorMessage={saveError}
		onSubmit={handleSubmit}
		onCancel={toCatalog}
	/>
</div>
