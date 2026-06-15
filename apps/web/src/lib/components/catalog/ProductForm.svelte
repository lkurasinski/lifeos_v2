<script lang="ts">
	import { untrack } from "svelte";
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import { Field } from "$lib/components/ui/field";
	import { Gauge } from "$lib/components/ui/gauge";
	import { Input } from "$lib/components/ui/input";
	import { NumberField } from "$lib/components/ui/number-field";
	import { Panel } from "$lib/components/ui/panel";
	import type { DraftProduct, NutrientRegistryGroup } from "$lib/food/schema";
	import { t } from "$lib/i18n";
	import CategoryIcon from "./CategoryIcon.svelte";
	import NutrientGroupSection from "./NutrientGroupSection.svelte";
	import NutrientRow from "./NutrientRow.svelte";
	import { formatAmount, macroGauges, macroPct, nutrientGroupLabels, sourceBadgeKey } from "./meta";
	import { parseAmount, seedFields, buildDraftProduct, type AmountField } from "./product-form";

	// The shared editable product surface — the DESIGN.md "AI suggestion surface /
	// editable preview", realizing the locked off-add.html. One form for OFF preview,
	// manual entry, and edit: it takes a canonical DraftProduct, lets the user correct
	// every field, and emits an updated DraftProduct on save (the parent owns the
	// fetch + endpoint). NULL ≠ 0 is preserved end-to-end: an EMPTY input means "no
	// data" (rendered dashed + "brak danych"), distinct from a typed 0.
	type CategoryOption = { id: string; namePl: string; slug?: string | null };

	type Props = {
		draft: DraftProduct;
		registry: NutrientRegistryGroup[];
		categories: CategoryOption[];
		mode: "create" | "edit";
		/** Parent-controlled busy state (disables the form while the save round-trips). */
		saving?: boolean;
		/** Parent-controlled error message (save conflict / network), shown in the action bar. */
		errorMessage?: string | null;
		onSubmit: (draft: DraftProduct) => void;
		onCancel?: () => void;
		cancelLabel?: string;
	};

	let {
		draft,
		registry,
		categories,
		mode,
		saving = false,
		errorMessage = null,
		onSubmit,
		onCancel,
		cancelLabel,
	}: Props = $props();

	// Editable state, seeded ONCE from the draft via the pure `seedFields`. The parent remounts
	// the form via {#key} when the selected draft changes, so a one-time snapshot is intended;
	// `untrack` takes that snapshot without subscribing this seed to later draft churn. Nutrient
	// values are raw inputs keyed by nutrientId — "" / null = NULL (no data), distinct from a
	// typed 0; seeded only with present (non-null) amounts. A `type="number"` `bind:value` yields
	// a number (or null when emptied), so these slots hold `number | string | null` at runtime.
	const init = untrack(() => seedFields(draft));

	let nameEn = $state(init.nameEn);
	let namePl = $state(init.namePl);
	let brand = $state(init.brand);
	let categoryId = $state(init.categoryId);
	let servingSizeG = $state<AmountField>(init.servingSizeG);
	let densityGPerMl = $state<AmountField>(init.densityGPerMl);
	let pieceWeightG = $state<AmountField>(init.pieceWeightG);
	let values = $state<Record<string, AmountField>>(init.values);

	// Group expand/collapse — default every group open (the locked probe shows them expanded).
	let collapsed = $state<Record<string, boolean>>({});
	function toggleGroup(category: string) {
		collapsed[category] = !collapsed[category];
	}

	const GROUP_LABEL = nutrientGroupLabels();

	const badgeKey = $derived(sourceBadgeKey(draft.source));
	const SOURCE_BADGE: Record<"usda" | "custom" | "off", string> = {
		usda: t("catalog.sourceBadge.usda"),
		custom: t("catalog.sourceBadge.custom"),
		off: t("catalog.sourceBadge.off"),
	};

	// Eyebrow copy by context — OFF preview vs manual entry vs edit.
	const eyebrow = $derived(
		mode === "edit"
			? { title: t("add.editEyebrow"), sub: t("add.editSubtitle") }
			: draft.source === "OFF"
				? { title: t("add.previewEyebrow"), sub: t("add.previewSubtitle") }
				: { title: t("add.manualEyebrow"), sub: t("add.manualSubtitle") },
	);

	// Four presentational macro rings, driven live by the matching field values. The
	// form's `values` are keyed by nutrientId, which IS the INFOODS tagname — so the
	// macro gauge tag indexes `values` directly.
	const gauges = $derived(
		macroGauges().map((g) => {
			const value = parseAmount(values[g.tag]);
			const pct = value === null ? 0 : macroPct(value, g.max);
			return { ...g, value, pct };
		}),
	);

	// Selected category slug → drives the chip's identity glyph (neutral grid when none).
	const selectedCategorySlug = $derived(categories.find((c) => c.id === categoryId)?.slug ?? null);

	const canSave = $derived((nameEn.trim() !== "" || namePl.trim() !== "") && !saving);

	function submit() {
		// Assemble the canonical draft from the current fields (NULL≠0, nameEn fallback, image
		// passthrough, every-registry-nutrient emission all live in the pure `buildDraftProduct`).
		onSubmit(
			buildDraftProduct(
				{ nameEn, namePl, brand, categoryId, servingSizeG, densityGPerMl, pieceWeightG, values },
				draft,
				registry,
			),
		);
	}
</script>

<Panel variant="thick" class="pf flex flex-col overflow-hidden rounded-lg p-0">
	<div class="flex items-start gap-[14px] px-[22px] pt-[18px] max-md:px-4">
		<div class="min-w-0 flex-1">
			<div class="text-[0.5625rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
				{eyebrow.title}
			</div>
			<div class="mt-[3px] text-[0.8125rem] leading-[1.4] text-muted-foreground">{eyebrow.sub}</div>
		</div>
		{#if mode === "create"}
			<!-- Neutral "unsaved" pill — never a semantic hue (colour is reserved for scored data). -->
			<span
				class="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-pill bg-card py-1.5 pl-[9px] pr-[11px] text-[0.6875rem] font-semibold tracking-[0.04em] text-foreground shadow-soft"
			>
				<span class="pulse"></span>{t("add.draftUnsaved")}
			</span>
		{/if}
	</div>

	<div class="px-[22px] pb-1 pt-[14px] max-md:px-4">
		{#if draft.imageThumbUrl ?? draft.imageUrl}
			<!-- OFF preview photo — contained on a neutral tile; fixed height reserves space so the form doesn't jump on load. -->
			<div class="mb-[14px] grid h-[200px] place-items-center rounded-lg bg-secondary p-3">
				<img
					class="max-h-full max-w-full rounded-sm object-contain"
					src={draft.imageThumbUrl ?? draft.imageUrl}
					alt={t("catalog.photoAlt")}
					loading="lazy"
				/>
			</div>
		{/if}

		<div class="mb-[13px] flex flex-wrap items-center gap-2">
			<Badge>{SOURCE_BADGE[badgeKey]}</Badge>
			{#if draft.source === "OFF" && draft.sourceId}
				<Badge>{t("catalog.sourceId.off")} {draft.sourceId}</Badge>
			{/if}
			<!-- Editable category select styled as a chip with a leading glyph + chevron. -->
			<span class="relative inline-flex items-center">
				<CategoryIcon
					slug={selectedCategorySlug}
					size={13}
					class="pointer-events-none absolute left-[9px]"
				/>
				<select
					class="cursor-pointer appearance-none rounded-pill border-0 bg-card px-[26px] py-[5px] text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-foreground shadow-soft outline-none focus:shadow-[var(--shadow-soft),var(--focus)]"
					aria-label={t("add.categoryLabel")}
					bind:value={categoryId}
				>
					<option value="">{t("add.noCategory")}</option>
					{#each categories as c (c.id)}
						<option value={c.id}>{c.namePl}</option>
					{/each}
				</select>
				<svg
					class="pointer-events-none absolute right-2 h-[13px] w-[13px] text-muted-foreground"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M10 13.5l-4.5-5h9z" />
				</svg>
			</span>
		</div>

		<div class="flex flex-col gap-1.5">
			<div class="relative">
				<Input
					variant="seamless"
					class="py-[5px] pl-[9px] pr-8 text-2xl font-semibold leading-[1.15] tracking-[-0.02em] max-md:text-[1.375rem]"
					type="text"
					bind:value={namePl}
					aria-label={t("add.namePlLabel")}
					placeholder={t("add.namePlLabel")}
				/>
				<span
					class="pointer-events-none absolute right-[9px] top-1/2 -translate-y-1/2 text-[0.5625rem] font-semibold tracking-[0.08em] text-muted-foreground"
					>PL</span
				>
			</div>
			<div class="relative">
				<Input
					variant="seamless"
					class="py-[5px] pl-[9px] pr-8 text-[0.875rem] text-muted-foreground"
					type="text"
					bind:value={nameEn}
					aria-label={t("add.nameEnLabel")}
					placeholder={t("add.nameEnLabel")}
				/>
				<span
					class="pointer-events-none absolute right-[9px] top-1/2 -translate-y-1/2 text-[0.5625rem] font-semibold tracking-[0.08em] text-muted-foreground"
					>EN</span
				>
			</div>
		</div>

		<div
			class="mb-[11px] mt-[18px] text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground"
		>
			{t("add.profileBasis")}
		</div>
		<div class="grid grid-cols-4 gap-2.5">
			{#each gauges as g (g.macro)}
				<Gauge
					macro={g.macro}
					value={g.pct}
					display={g.value === null ? "—" : formatAmount(g.value)}
					unit={g.value === null ? undefined : g.unit}
					label={g.label}
				/>
			{/each}
		</div>

		<div class="mt-4 flex flex-col gap-2.5">
			<Field orientation="horizontal" label={t("add.brandLabel")}>
				<input
					class="min-w-0 max-w-[260px] flex-1 rounded-sm border bg-card px-[9px] py-[7px] text-right text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground focus:border-transparent focus:shadow-[var(--focus)]"
					type="text"
					bind:value={brand}
					placeholder={t("add.brandPlaceholder")}
					aria-label={t("add.brandLabel")}
				/>
			</Field>
			<Field orientation="horizontal" label={t("add.servingSize")}>
				<NumberField
					bind:value={servingSizeG}
					class="w-24"
					unit="g"
					inputmode="decimal"
					min="0"
					aria-label={t("add.servingSize")}
				/>
			</Field>
			<Field orientation="horizontal" label={t("add.density")}>
				<NumberField
					bind:value={densityGPerMl}
					class="w-24"
					unit="g/ml"
					inputClass="pr-[36px]"
					inputmode="decimal"
					min="0"
					step="any"
					aria-label={t("add.density")}
				/>
			</Field>
			<Field orientation="horizontal" label={t("add.pieceWeight")}>
				<NumberField
					bind:value={pieceWeightG}
					class="w-24"
					unit="g"
					inputmode="decimal"
					min="0"
					step="any"
					aria-label={t("add.pieceWeight")}
				/>
			</Field>
			<p class="text-[0.6875rem] leading-[1.4] text-muted-foreground">{t("add.conversionHint")}</p>
		</div>

		<div class="my-[18px] h-px bg-[var(--hairline)]"></div>

		<div
			class="mb-1 flex items-center justify-between gap-2.5 text-[0.6875rem] text-muted-foreground"
		>
			<span class="text-[0.625rem] font-medium uppercase tracking-[0.06em]"
				>{t("add.fullProfile")}</span
			>
			<span class="inline-flex items-center gap-1.5 text-right">
				<svg
					class="h-[13px] w-[13px] shrink-0 opacity-60"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"
						clip-rule="evenodd"
					/>
				</svg>
				{t("add.noDataHint")}
			</span>
		</div>

		{#each registry as group (group.category)}
			{@const filled = group.nutrients.filter((n) => parseAmount(values[n.id]) !== null).length}
			<NutrientGroupSection
				label={GROUP_LABEL[group.category] ?? group.category}
				count={`${filled}/${group.nutrients.length}`}
				collapsible
				open={!collapsed[group.category]}
				onToggle={() => toggleGroup(group.category)}
			>
				{#each group.nutrients as n (n.id)}
					<NutrientRow label={n.namePl || n.nameEn} unit={n.unit} bind:value={values[n.id]} />
				{/each}
			</NutrientGroupSection>
		{/each}
	</div>

	<!-- Sticky glass action bar — the weightier action (Save) sits on the right. -->
	<div class="pf-bar">
		<Button type="button" variant="ghost" onclick={() => onCancel?.()}>
			{cancelLabel ?? t("common.cancel")}
		</Button>
		<span
			class={[
				"flex-1 text-center text-[0.6875rem] leading-[1.4]",
				errorMessage ? "text-destructive" : "text-muted-foreground",
			]}>{errorMessage ?? ""}</span
		>
		<Button onclick={submit} disabled={!canSave}>
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					d="M4.5 3A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5V7.2a1.5 1.5 0 0 0-.44-1.06l-2.7-2.7A1.5 1.5 0 0 0 12.8 3H4.5Zm1 1.8h6V8h-6V4.8ZM10 14.6a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z"
				/>
			</svg>
			{saving ? t("add.saving") : mode === "edit" ? t("common.save") : t("add.save")}
		</Button>
	</div>
</Panel>

<style>
	/* Entrance animation — keyframe kept scoped (applied to the Panel root via the `pf` class). */
	@media (prefers-reduced-motion: no-preference) {
		:global(.pf) {
			animation: pf-materialize 0.5s var(--ease-expo) both;
		}
		@keyframes pf-materialize {
			from {
				opacity: 0;
				transform: translateY(10px) scale(0.985);
			}
		}
	}

	/* "Unsaved" pulse dot — animated ring via ::after (no utility equivalent). */
	.pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--muted-foreground);
		position: relative;
	}
	.pulse::after {
		content: "";
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		border: 1.5px solid var(--muted-foreground);
		opacity: 0.45;
		animation: pf-ring 2s var(--ease) infinite;
	}
	@keyframes pf-ring {
		0% {
			transform: scale(0.6);
			opacity: 0.5;
		}
		100% {
			transform: scale(1.5);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pulse::after {
			animation: none;
		}
	}

	/* Sticky glass action bar — frosted material with a solid fallback. */
	.pf-bar {
		position: sticky;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 18px;
		padding: 16px 22px;
		background: var(--glass-fill-thick);
		backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		-webkit-backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		border-top: 1px solid var(--hairline);
	}
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.pf-bar {
			background: var(--card);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pf-bar {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--card);
		}
	}
	@media (max-width: 768px) {
		.pf-bar {
			padding-left: 16px;
			padding-right: 16px;
		}
	}
</style>
