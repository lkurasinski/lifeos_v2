<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { toast } from "$lib/components/ui/sonner";
	import ProductForm from "$lib/components/catalog/ProductForm.svelte";
	import { draftToSavePayload, type DraftProduct } from "$lib/food/schema";
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

	function productName(d: DraftProduct): string {
		return d.namePl?.trim() || d.nameEn;
	}

	async function handleSubmit(draft: DraftProduct) {
		if (saving) return;
		saving = true;
		saveError = null;
		// The full save payload carries every field through (no field-by-field rebuild);
		// the endpoint's patchPayloadSchema strips the immutable source/sourceId.
		const payload = draftToSavePayload(draft);
		const name = productName(draft);
		try {
			const res = await fetch(`/api/foods/${data.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (res.status === 404) {
				// The product vanished (deleted in another tab) — toast and return to the list.
				toast.error(t("edit.notFound"), { description: name });
				toCatalog();
				return;
			}
			if (!res.ok) {
				saveError = t("add.saveError");
				toast.error(t("add.saveError"), { description: name });
				return;
			}
			toast.success(t("edit.updated"), { description: name });
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
	<title>{t("edit.title")} — {t("common.appName")}</title>
</svelte:head>

<div class="editscreen">
	<div class="edittop">
		<IconButton onclick={toCatalog} aria-label={t("add.close")}>
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M12.7 4.3a1 1 0 0 1 0 1.4L8.42 10l4.3 4.3a1 1 0 1 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z"
					clip-rule="evenodd"
				/>
			</svg>
		</IconButton>
		<h1>{t("edit.title")}</h1>
		<button type="button" class="cancel" onclick={toCatalog}>{t("common.cancel")}</button>
	</div>

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
	.editscreen {
		min-height: 100svh;
	}

	.edittop {
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
	.edittop h1 {
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--foreground);
	}
	.edittop .cancel {
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
	.edittop .cancel:hover {
		background: var(--accent);
		color: var(--foreground);
	}

	/* The form is the whole screen here (no finder column) — center it in a readable column. */
	.flow {
		max-width: 640px;
		margin-inline: auto;
		padding: 18px 24px 48px;
	}

	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.edittop {
			background: var(--card);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.edittop {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--card);
		}
	}

	@media (max-width: 768px) {
		.edittop {
			padding: 12px 16px;
		}
		.flow {
			padding: 14px 16px 64px;
		}
	}
</style>
