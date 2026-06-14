<script lang="ts">
	import { untrack, type Snippet } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { Panel } from "$lib/components/ui/panel";
	import { SegmentedToggle } from "$lib/components/ui/segmented";
	import type { FoodCategoryMeta, NutrientRegistryGroup } from "$lib/food/schema";
	import type {
		RecipeDraft,
		RecipeTaxonomies,
		RecipeDifficulty,
		UnitOption,
	} from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import ComponentEditor from "./ComponentEditor.svelte";
	import StepsEditor from "./StepsEditor.svelte";
	import LiveNutritionPanel from "./LiveNutritionPanel.svelte";
	import TaxonomyEditor from "./TaxonomyEditor.svelte";
	import { difficultyOptions } from "./meta";

	// The recipe authoring surface (locked by `form.html`): left column = name/description,
	// ingredient editor, metadata chips, steps, tips; right sticky column = the LIVE per-serving
	// rollup (recomputed client-side via the Phase 2 engine) + publication (status × visibility);
	// a sticky action bar commits as draft or published. Mirrors `ProductForm`'s prop shape
	// (draft / options / mode / saving / errorMessage / onSubmit / onCancel) + a delete affordance.
	type Props = {
		draft: RecipeDraft;
		taxonomies: RecipeTaxonomies;
		units: UnitOption[];
		registry: NutrientRegistryGroup[];
		categories: FoodCategoryMeta[];
		mode: "create" | "edit";
		saving?: boolean;
		errorMessage?: string | null;
		/** The recipe being edited (excluded from its own sub-recipe picker); undefined on create. */
		excludeRecipeId?: string;
		onSubmit: (draft: RecipeDraft) => void;
		onCancel?: () => void;
		/** Owner delete (edit mode only) — the host opens the confirm + DELETE round-trip. */
		onDelete?: () => void;
	};

	let {
		draft,
		taxonomies,
		units,
		registry,
		categories,
		mode,
		saving = false,
		errorMessage = null,
		excludeRecipeId,
		onSubmit,
		onCancel,
		onDelete,
	}: Props = $props();

	// Editable copy, seeded ONCE (the host remounts via {#key} when the loaded draft changes).
	let data = $state<RecipeDraft>(untrack(() => structuredClone(draft)));
	let localError = $state<string | null>(null);

	// The ingredient picker's popover overflows its glass section; each glass `Panel` is its own
	// stacking context (backdrop-filter), so a trapped `z-index` paints behind the next section.
	// Lift the ingredients section above its siblings while a picker is open.
	let pickerOpen = $state(false);

	const difficulties = difficultyOptions();

	// Count of contributing components — drives the ingredients section header AND the live
	// nutrition panel's footer (passed down to keep a single source of truth).
	const componentCount = $derived(
		data.components.filter(
			(c) => (c.productId || c.subRecipeId) && c.amount != null && c.amount > 0,
		).length,
	);

	// ─── Submit ───────────────────────────────────────────────────────────────────────
	const canSave = $derived(data.name.trim() !== "" && !saving);

	function submitAs(status: "DRAFT" | "PUBLISHED") {
		if (saving) return;
		if (data.name.trim() === "") {
			localError = t("recipe.form.nameRequired");
			return;
		}
		localError = null;
		data.status = status;
		onSubmit($state.snapshot(data) as RecipeDraft);
	}

	const barError = $derived(errorMessage ?? localError);
</script>

{#snippet sectHead(icon: Snippet, title: string, count: string | null)}
	<div class="sect-h">
		<span class="icn">{@render icon()}</span>
		<span class="ti">{title}</span>
		{#if count}<span class="ct">{count}</span>{/if}
	</div>
{/snippet}

{#snippet listIcon()}<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
		><path
			d="M7 5h9M7 10h9M7 15h9"
			stroke="currentColor"
			stroke-width="1.7"
			stroke-linecap="round"
			fill="none"
		/><circle cx="3.5" cy="5" r="1.2" /><circle cx="3.5" cy="10" r="1.2" /><circle
			cx="3.5"
			cy="15"
			r="1.2"
		/></svg
	>{/snippet}
{#snippet slidersIcon()}<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
		><path
			d="M4 6h7M14 6h2M4 14h2M9 14h7"
			stroke="currentColor"
			stroke-width="1.7"
			stroke-linecap="round"
			fill="none"
		/><circle cx="12.5" cy="6" r="2.1" /><circle cx="7.5" cy="14" r="2.1" /></svg
	>{/snippet}
{#snippet stepsIcon()}<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
		><path d="M3 15h4v-4H3zM8 11h4V7H8zM13 7h4V3h-4z" opacity=".9" /></svg
	>{/snippet}
{#snippet bulbIcon()}<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
		><path
			d="M10 2.2a5.3 5.3 0 0 0-3.2 9.5c.5.4.8.9.9 1.5l.1.8h4.4l.1-.8c.1-.6.4-1.1.9-1.5A5.3 5.3 0 0 0 10 2.2Z"
		/><path
			d="M7.7 16.2h4.6M8.4 17.8h3.2"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		/></svg
	>{/snippet}

<div class="flow">
	<!-- ── LEFT: editors ── -->
	<div class="col-main">
		<Panel variant="thick" class="sect">
			<input
				class="namebig"
				type="text"
				bind:value={data.name}
				placeholder={t("recipe.form.namePlaceholder")}
				aria-label={t("recipe.form.namePlaceholder")}
			/>
			<textarea
				class="descbox"
				bind:value={data.description}
				placeholder={t("recipe.form.descPlaceholder")}
				aria-label={t("recipe.form.descPlaceholder")}
			></textarea>
		</Panel>

		<Panel variant="thick" class={pickerOpen ? "sect sect-elevated" : "sect"}>
			{@render sectHead(
				listIcon,
				t("recipe.form.ingredientsTitle"),
				`${componentCount} ${t("recipe.form.itemsCount")}`,
			)}
			<ComponentEditor
				bind:components={data.components}
				{units}
				{registry}
				{categories}
				{excludeRecipeId}
				onPickerOpenChange={(o) => (pickerOpen = o)}
			/>
		</Panel>

		<Panel variant="thick" class="sect">
			{@render sectHead(slidersIcon, t("recipe.form.detailsTitle"), null)}
			<div class="metagrid">
				<div class="nums">
					<label class="numf">
						<span class="flab">{t("recipe.form.servingsLabel")}</span>
						<span class="numwrap"
							><input
								type="number"
								inputmode="numeric"
								min="1"
								step="1"
								bind:value={data.servings}
								aria-label={t("recipe.form.servingsLabel")}
							/></span
						>
					</label>
					<label class="numf">
						<span class="flab">{t("recipe.form.prepLabel")}</span>
						<span class="numwrap"
							><input
								type="number"
								inputmode="numeric"
								min="0"
								step="1"
								bind:value={data.prepTimeMin}
								aria-label={t("recipe.form.prepLabel")}
							/><span class="nu">{t("recipe.form.minUnit")}</span></span
						>
					</label>
					<label class="numf">
						<span class="flab">{t("recipe.form.cookLabel")}</span>
						<span class="numwrap"
							><input
								type="number"
								inputmode="numeric"
								min="0"
								step="1"
								bind:value={data.cookTimeMin}
								aria-label={t("recipe.form.cookLabel")}
							/><span class="nu">{t("recipe.form.minUnit")}</span></span
						>
					</label>
				</div>

				<div class="metafield">
					<span class="flab">{t("recipe.form.difficultyLabel")}</span>
					<SegmentedToggle
						items={difficulties.map((d) => ({ value: d.value, label: d.label }))}
						value={data.difficulty ?? ""}
						aria-label={t("recipe.form.difficultyLabel")}
						onValueChange={(v) => (data.difficulty = (v || null) as RecipeDifficulty | null)}
					/>
				</div>

				<TaxonomyEditor
					{taxonomies}
					bind:mealTypeIds={data.mealTypeIds}
					bind:diets={data.diets}
					bind:techniques={data.techniques}
					bind:allergens={data.allergens}
					bind:cuisineId={data.cuisineId}
				/>
			</div>
		</Panel>

		<Panel variant="thick" class="sect">
			{@render sectHead(stepsIcon, t("recipe.form.stepsTitle"), null)}
			<StepsEditor bind:steps={data.steps} />
		</Panel>

		<Panel variant="thick" class="sect">
			{@render sectHead(bulbIcon, t("recipe.form.tipsTitle"), `${data.tips.length}`)}
			<div class="tipslist">
				{#each data.tips as tip, i (i)}
					<div class="tipe">
						<span class="ti"
							><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
								><path
									d="M10 2.2a5.3 5.3 0 0 0-3.2 9.5c.5.4.8.9.9 1.5l.1.8h4.4l.1-.8c.1-.6.4-1.1.9-1.5A5.3 5.3 0 0 0 10 2.2Z"
								/></svg
							></span
						>
						<input
							type="text"
							value={tip}
							oninput={(e) => (data.tips[i] = e.currentTarget.value)}
							aria-label={t("recipe.form.tipsTitle")}
						/>
						<IconButton
							type="button"
							variant="ghost"
							size="sm"
							class="size-[30px]"
							aria-label={t("recipe.form.removeRow")}
							onclick={() => (data.tips = data.tips.filter((_, j) => j !== i))}
						>
							<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
								><path
									d="M5.7 5.7a1 1 0 0 1 1.4 0L10 8.6l2.9-2.9a1 1 0 1 1 1.4 1.4L11.4 10l2.9 2.9a1 1 0 0 1-1.4 1.4L10 11.4l-2.9 2.9a1 1 0 0 1-1.4-1.4L8.6 10 5.7 7.1a1 1 0 0 1 0-1.4Z"
								/></svg
							>
						</IconButton>
					</div>
				{/each}
				<Button
					type="button"
					variant="secondary"
					size="sm"
					class="mt-1 self-start"
					onclick={() => (data.tips = [...data.tips, ""])}
				>
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
						><path
							d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z"
						/></svg
					>
					{t("recipe.form.tipPlaceholder")}
				</Button>
			</div>
		</Panel>
	</div>

	<!-- ── RIGHT: live rollup + publication (sticky) ── -->
	<div class="col-side">
		<LiveNutritionPanel
			components={data.components}
			servings={data.servings}
			{units}
			{componentCount}
		/>

		<Panel class="pub">
			<div class="pub-h">{t("recipe.form.publishTitle")}</div>
			<div class="pubf">
				<div class="pl">{t("recipe.form.statusLabel")}</div>
				<div class="pd">{t("recipe.form.statusHint")}</div>
				<SegmentedToggle
					class="w-full"
					items={[
						{ value: "DRAFT", label: t("recipe.form.statusDraft") },
						{ value: "PUBLISHED", label: t("recipe.form.statusPublished") },
					]}
					value={data.status}
					aria-label={t("recipe.form.statusLabel")}
					onValueChange={(v) => (data.status = (v || "DRAFT") as "DRAFT" | "PUBLISHED")}
				/>
			</div>
			<div class="pubf">
				<div class="pl">{t("recipe.form.visibilityLabel")}</div>
				<div class="pd">{t("recipe.form.visibilityHint")}</div>
				<SegmentedToggle
					class="w-full"
					items={[
						{ value: "PUBLIC", label: t("recipe.form.visibilityPublic") },
						{ value: "PRIVATE", label: t("recipe.form.visibilityPrivate") },
					]}
					value={data.visibility}
					aria-label={t("recipe.form.visibilityLabel")}
					onValueChange={(v) => (data.visibility = (v || "PUBLIC") as "PUBLIC" | "PRIVATE")}
				/>
			</div>
		</Panel>
	</div>
</div>

<!-- sticky action bar -->
<div class="formbar">
	{#if mode === "edit" && onDelete}
		<button type="button" class="ghost" onclick={() => onDelete?.()}
			>{t("recipe.form.deleteRecipe")}</button
		>
	{:else if onCancel}
		<button type="button" class="ghost" onclick={() => onCancel?.()}>{t("common.cancel")}</button>
	{/if}
	<span class="spacer"></span>
	<span class={["meta", barError ? "err" : ""]}>
		{#if barError}
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
				><path
					fill-rule="evenodd"
					d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"
					clip-rule="evenodd"
				/></svg
			>
			{barError}
		{:else}
			{t("recipe.form.unsavedNote")}
		{/if}
	</span>
	<Button variant="secondary" disabled={!canSave} onclick={() => submitAs("DRAFT")}>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
			><path
				d="M4.5 3A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5V7.2a1.5 1.5 0 0 0-.44-1.06l-2.7-2.7A1.5 1.5 0 0 0 12.8 3H4.5Zm1 1.8h6V8h-6V4.8ZM10 14.6a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z"
			/></svg
		>
		{saving ? t("recipe.form.saving") : t("recipe.form.saveDraft")}
	</Button>
	<Button disabled={!canSave} onclick={() => submitAs("PUBLISHED")}>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
			><path
				d="M4.5 10.5l3.2 3.2 7-7"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/></svg
		>
		{saving ? t("recipe.form.saving") : t("recipe.form.publish")}
	</Button>
</div>

<style>
	.flow {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 384px;
		gap: 20px;
		padding: 16px 24px 40px;
		align-items: start;
		max-width: 1280px;
		margin-inline: auto;
	}
	.col-main {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}
	.col-side {
		position: sticky;
		top: 84px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}

	:global(.sect) {
		padding: 18px 20px 19px;
		border-radius: var(--radius);
	}
	/* While a picker popover is open, lift this section's glass stacking context above the
	   following sections so the overflowing popover isn't painted behind them. */
	:global(.sect-elevated) {
		position: relative;
		z-index: 30;
	}
	.sect-h {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 15px;
	}
	.sect-h .icn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--muted-foreground);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.sect-h .icn :global(svg) {
		width: 16px;
		height: 16px;
	}
	.sect-h .ti {
		font-size: 1.0625rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--foreground);
	}
	.sect-h .ct {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.namebig {
		width: 100%;
		font-family: inherit;
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.2;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 12px 14px;
		outline: none;
	}
	.namebig:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.namebig::placeholder {
		color: var(--muted-foreground);
		font-weight: 500;
	}
	.descbox {
		width: 100%;
		margin-top: 10px;
		font-family: inherit;
		font-size: 0.9375rem;
		line-height: 1.55;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 11px 14px;
		outline: none;
		resize: vertical;
		min-height: 74px;
	}
	.descbox:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.descbox::placeholder {
		color: var(--muted-foreground);
	}

	.metagrid {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.metafield {
		display: flex;
		flex-direction: column;
	}
	.flab {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-bottom: 8px;
	}
	.nums {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	.numf {
		display: flex;
		flex-direction: column;
	}
	.numwrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	.numwrap input {
		width: 100%;
		font-family: inherit;
		font-size: 0.9375rem;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 10px 38px 10px 12px;
		outline: none;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.numwrap input::-webkit-outer-spin-button,
	.numwrap input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.numwrap input:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.numwrap .nu {
		position: absolute;
		right: 11px;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		pointer-events: none;
	}

	.tipslist {
		display: flex;
		flex-direction: column;
		gap: 9px;
	}
	.tipe {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) 30px;
		gap: 10px;
		align-items: center;
	}
	.tipe .ti {
		color: var(--muted-foreground);
		display: flex;
		justify-content: center;
	}
	.tipe .ti svg {
		width: 15px;
		height: 15px;
	}
	.tipe input {
		width: 100%;
		font-family: inherit;
		font-size: 0.875rem;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 9px 12px;
		outline: none;
	}
	.tipe input:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.tipe input::placeholder {
		color: var(--muted-foreground);
	}

	/* ── side: publication ── */
	:global(.pub) {
		padding: 16px 18px 18px;
		border-radius: var(--radius);
	}
	.pub-h {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-bottom: 13px;
	}
	.pubf {
		margin-bottom: 13px;
	}
	.pubf:last-child {
		margin-bottom: 0;
	}
	.pubf .pl {
		font-size: 0.8125rem;
		font-weight: 550;
		margin-bottom: 3px;
		color: var(--foreground);
	}
	.pubf .pd {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		line-height: 1.4;
		margin-bottom: 8px;
	}

	/* ── sticky action bar ── */
	.formbar {
		position: sticky;
		bottom: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 15px 24px;
		background: var(--glass-fill-thick);
		backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		-webkit-backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		border-top: 1px solid var(--hairline);
	}
	.formbar .ghost {
		border: 0;
		background: transparent;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 13px 12px;
		border-radius: var(--radius-sm);
	}
	.formbar .ghost:hover {
		background: var(--accent);
		color: var(--foreground);
	}
	.formbar .spacer {
		flex: 1;
	}
	.formbar .meta {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		margin-right: 6px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 40ch;
	}
	.formbar .meta.err {
		color: var(--destructive);
	}
	.formbar .meta svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.formbar {
			background: var(--card);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.formbar {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--card);
		}
	}

	/* Collapse to a single column below the two-column breakpoint (Phase 7 refines mobile). */
	@media (max-width: 960px) {
		.flow {
			grid-template-columns: minmax(0, 1fr);
		}
		.col-side {
			position: static;
			order: -1;
		}
	}
	@media (max-width: 768px) {
		.flow {
			padding: 14px 16px 40px;
		}
		.nums {
			grid-template-columns: 1fr;
		}
	}
</style>
