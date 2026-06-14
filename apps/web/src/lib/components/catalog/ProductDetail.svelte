<script lang="ts">
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import { Gauge } from "$lib/components/ui/gauge";
	import { Panel } from "$lib/components/ui/panel";
	import type { FoodDocument, NutrientRegistryGroup } from "$lib/food/schema";
	import { t } from "$lib/i18n";
	import CategoryIcon from "./CategoryIcon.svelte";
	import { CollapsibleSection } from "$lib/components/ui/collapsible-section";
	import NutrientGroupSection from "./NutrientGroupSection.svelte";
	import { formatAmount, groupRegistryRows, macroGauges, macroPct, sourceBadgeKey } from "./meta";

	// Detail panel for the selected product — four identity-hued macro rings (graphite
	// figure) over the full nutrient profile, grouped by registry category and
	// collapsible. Reads the in-hand Meili hit joined with the registry: no round-trip.
	// NULL ≠ 0 — an absent nutrient is HIDDEN; a stored 0 renders as "0".
	type Props = {
		hit: FoodDocument;
		registry: NutrientRegistryGroup[];
		/** When true, drop the glass Panel chrome — the host (a Dialog) is the surface. */
		embedded?: boolean;
		/** Edit affordance — the host routes to /foods/[id]/edit. Hidden when omitted. */
		onEdit?: (hit: FoodDocument) => void;
		/** Delete affordance — the host opens the confirm step. Hidden when omitted. */
		onDelete?: (hit: FoodDocument) => void;
	};

	let { hit, registry, embedded = false, onEdit, onDelete }: Props = $props();

	let open = $state(true);

	const SOURCE_BADGE: Record<"usda" | "custom" | "off", string> = {
		usda: t("catalog.sourceBadge.usda"),
		custom: t("catalog.sourceBadge.custom"),
		off: t("catalog.sourceBadge.off"),
	};
	const ORIGIN: Record<"usda" | "custom" | "off", string> = {
		usda: t("catalog.origin.usda"),
		custom: t("catalog.origin.custom"),
		off: t("catalog.origin.off"),
	};
	// Identifier label per verified source — the OFF barcode / USDA FDC id. CUSTOM
	// products carry a generated UUID, which isn't meaningful to surface.
	const SOURCE_ID_LABEL: Partial<Record<"usda" | "custom" | "off", string>> = {
		usda: t("catalog.sourceId.usda"),
		off: t("catalog.sourceId.off"),
	};

	const badgeKey = $derived(sourceBadgeKey(hit.source));

	// The macro value for each ring comes from the in-hand Meili hit (absent = undefined,
	// rendered as "—" — NULL≠0). The descriptor (label/unit/max) is the shared one.
	const macroValue = $derived<Record<string, number | undefined>>({
		kcal: hit.energyKcal,
		pro: hit.protein,
		carb: hit.carbs,
		fat: hit.fat,
	});
	const gauges = $derived(macroGauges().map((g) => ({ ...g, value: macroValue[g.macro] })));

	// Present nutrients grouped by registry category via the shared `groupRegistryRows` (absent
	// ones already omitted from the hit's `nutrients` map — NULL≠0). Empty groups are dropped.
	const groups = $derived(groupRegistryRows(registry, hit.nutrients));
	const totalCount = $derived(groups.reduce((sum, g) => sum + g.rows.length, 0));

	// OFF product photos (CC-BY-SA). Hero = main display image; the ingredients/nutrition
	// shots open full-size in a new tab. Credit shown whenever any photo is displayed.
	const mainImage = $derived(hit.imageUrl ?? hit.imageThumbUrl ?? null);
	const extraPhotos = $derived(
		(
			[
				{ url: hit.imageIngredientsUrl, label: t("catalog.photoIngredients") },
				{ url: hit.imageNutritionUrl, label: t("catalog.photoNutrition") },
			] as { url: string | undefined; label: string }[]
		).filter((p): p is { url: string; label: string } => !!p.url),
	);
	const hasAnyPhoto = $derived(!!mainImage || extraPhotos.length > 0);
</script>

{#snippet body()}
	{#if mainImage}
		<!-- OFF hero photo — contained on a neutral tile so portrait/landscape shots don't
		     crop. Fixed height reserves the space (tile = placeholder) so the layout doesn't
		     jump when the image finishes loading. -->
		<div class="mb-[14px] grid h-[220px] place-items-center rounded-lg bg-secondary p-3">
			<img
				class="max-h-full max-w-full rounded-sm object-contain"
				src={mainImage}
				alt={hit.namePl ?? hit.nameEn ?? t("catalog.photoAlt")}
				loading="lazy"
			/>
		</div>
	{/if}

	<div class="mb-[11px] flex items-center gap-2">
		<Badge>
			<CategoryIcon slug={hit.categorySlug} size={13} />
			{hit.categoryNamePl ?? t("catalog.uncategorized")}
		</Badge>
		<Badge>{SOURCE_BADGE[badgeKey]}</Badge>
		{#if hit.userModified}
			<Badge variant="muted">{t("catalog.edited")}</Badge>
		{/if}
	</div>

	<div>
		<div class="text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground max-md:text-[1.375rem]">
			{hit.namePl ?? hit.nameEn}
		</div>
		{#if hit.namePl && hit.namePl !== hit.nameEn}
			<div class="mt-1 text-[0.875rem] text-muted-foreground">{hit.nameEn}</div>
		{/if}
		{#if hit.brand}
			<div class="mt-1.5 text-xs font-medium tracking-[0.02em] text-muted-foreground">{hit.brand}</div>
		{/if}
	</div>

	<div class="mb-2.5 mt-5 text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground max-md:mb-2 max-md:mt-4">
		{t("catalog.profileBasis")}
	</div>
	<div class="mt-[2px] grid grid-cols-4 gap-2.5 max-md:gap-1.5 max-[380px]:grid-cols-2 max-[380px]:gap-3">
		{#each gauges as g (g.macro)}
			<Gauge
				macro={g.macro}
				value={macroPct(g.value, g.max)}
				display={g.value === undefined ? "—" : formatAmount(g.value)}
				unit={g.value === undefined ? undefined : g.unit}
				label={g.label}
			/>
		{/each}
	</div>

	{#if totalCount > 0}
		<div class="my-[18px] h-px bg-[var(--hairline)]"></div>

		{#snippet fullProfileHeader()}
			<span class="text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">{t("catalog.fullProfile")}</span>
			<span class="text-[0.6875rem] tabular-nums text-muted-foreground">{totalCount} {t("catalog.nutrientsCount")}</span>
		{/snippet}

		<CollapsibleSection
			{open}
			onToggle={() => (open = !open)}
			buttonClass="p-0.5"
			chevronClass="ml-auto size-[17px]"
			header={fullProfileHeader}
		>
			{#each groups as group (group.label)}
				<NutrientGroupSection label={group.label} count={`${group.rows.length} ${t("catalog.itemsCount")}`}>
					{#each group.rows as row (row.id)}
						<div class="flex items-baseline justify-between py-1.5 pl-4 pr-0.5">
							<span class="text-[0.8125rem] text-muted-foreground">{row.name}</span>
							<span class="text-[0.875rem] tabular-nums tracking-[-0.01em] text-foreground">{formatAmount(row.value)} {row.unit}</span>
						</div>
					{/each}
				</NutrientGroupSection>
			{/each}
		</CollapsibleSection>
	{/if}

	{#if onEdit || onDelete}
		<!-- Edit / delete actions — glass "Usuń" shrinks, primary "Edytuj" fills (probe). -->
		<div class="mt-[22px] flex gap-2.5">
			{#if onDelete}
				<Button variant="secondary" onclick={() => onDelete?.(hit)}>
					{t("common.delete")}
				</Button>
			{/if}
			{#if onEdit}
				<Button class="flex-1" onclick={() => onEdit?.(hit)}>
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							d="M13.94 3.31a1.75 1.75 0 0 1 2.475 2.475l-8.3 8.3a2 2 0 0 1-.86.503l-2.74.76a.75.75 0 0 1-.922-.923l.76-2.74a2 2 0 0 1 .503-.86l8.3-8.3Z"
						/>
					</svg>
					{t("catalog.editProduct")}
				</Button>
			{/if}
		</div>
	{/if}

	{#if extraPhotos.length > 0}
		<div class="my-[18px] h-px bg-[var(--hairline)]"></div>
		<!-- Ingredients / nutrition shots — small thumbnails opening full-size in a new tab. -->
		<div class="mt-1">
			<div class="mb-[9px] text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">{t("catalog.photos")}</div>
			<div class="grid grid-cols-2 gap-2.5">
				{#each extraPhotos as p (p.label)}
					<div class="flex flex-col gap-[5px] text-[0.6875rem] text-muted-foreground">
						<img class="h-24 w-full rounded-sm bg-secondary object-cover shadow-soft" src={p.url} alt={p.label} loading="lazy" />
						<span>{p.label}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="mt-[18px] flex items-center gap-[7px] text-xs text-muted-foreground">
		<svg class="h-[14px] w-[14px] shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fill-rule="evenodd"
				d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"
				clip-rule="evenodd"
			/>
		</svg>
		{ORIGIN[badgeKey]}
	</div>
	{#if SOURCE_ID_LABEL[badgeKey] && hit.sourceId}
		<div class="mt-1.5 flex items-baseline gap-[7px] pl-[21px] text-xs">
			<span class="text-muted-foreground">{SOURCE_ID_LABEL[badgeKey]}</span>
			<span class="break-all tabular-nums text-foreground">{hit.sourceId}</span>
		</div>
	{/if}
	{#if hasAnyPhoto}
		<div class="mt-[14px] text-[0.625rem] text-muted-foreground opacity-80">{t("catalog.photoCredit")}</div>
	{/if}
{/snippet}

{#if embedded}
	<!-- Embedded (inside the Dialog): no glass chrome, no sticky — the dialog is the surface. -->
	<div class="flex flex-col px-[22px] pb-[22px] pt-6 max-md:px-4 max-md:pb-4 max-md:pt-5">{@render body()}</div>
{:else}
	<Panel variant="thick" class="sticky top-[18px] flex flex-col px-6 pb-[22px] pt-6">{@render body()}</Panel>
{/if}
