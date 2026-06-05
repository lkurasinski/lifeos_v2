<script lang="ts">
	import { Badge } from "$lib/components/ui/badge";
	import { Gauge, type Macro } from "$lib/components/ui/gauge";
	import { Panel } from "$lib/components/ui/panel";
	import type { FoodDocument, NutrientRegistryGroup } from "$lib/food/schema";
	import { t } from "$lib/i18n";
	import CategoryIcon from "./CategoryIcon.svelte";
	import { MACRO_REFERENCE, formatAmount, macroPct, sourceBadgeKey } from "./meta";

	// Detail panel for the selected product — four identity-hued macro rings (graphite
	// figure) over the full nutrient profile, grouped by registry category and
	// collapsible. Reads the in-hand Meili hit joined with the registry: no round-trip.
	// NULL ≠ 0 — an absent nutrient is HIDDEN; a stored 0 renders as "0".
	type Props = {
		hit: FoodDocument;
		registry: NutrientRegistryGroup[];
		/** When true, drop the glass Panel chrome — the host (a Dialog) is the surface. */
		embedded?: boolean;
	};

	let { hit, registry, embedded = false }: Props = $props();

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
	// NutrientCategory enum → Polish group heading (literal keys keep t() typed).
	const GROUP_LABEL: Record<string, string> = {
		ENERGY: t("catalog.nutrientGroup.energy"),
		PROXIMATE: t("catalog.nutrientGroup.proximate"),
		LIPID: t("catalog.nutrientGroup.lipid"),
		MINERAL: t("catalog.nutrientGroup.mineral"),
		VITAMIN: t("catalog.nutrientGroup.vitamin"),
		AMINO_ACID: t("catalog.nutrientGroup.aminoAcid"),
		CAROTENOID: t("catalog.nutrientGroup.carotenoid"),
		OTHER: t("catalog.nutrientGroup.other"),
	};

	const badgeKey = $derived(sourceBadgeKey(hit.source));

	const gauges = $derived(
		[
			{ macro: "kcal", label: t("catalog.macros.energy"), value: hit.energyKcal, unit: "kcal", max: MACRO_REFERENCE.kcal },
			{ macro: "pro", label: t("catalog.macros.protein"), value: hit.protein, unit: "g", max: MACRO_REFERENCE.protein },
			{ macro: "carb", label: t("catalog.macros.carbs"), value: hit.carbs, unit: "g", max: MACRO_REFERENCE.carbs },
			{ macro: "fat", label: t("catalog.macros.fat"), value: hit.fat, unit: "g", max: MACRO_REFERENCE.fat },
		] satisfies { macro: Macro; label: string; value: number | undefined; unit: string; max: number }[],
	);

	// Present nutrients grouped by registry category (absent ones already omitted from
	// the hit's `nutrients` map). Empty groups are dropped.
	const groups = $derived(
		registry
			.map((g) => ({
				label: GROUP_LABEL[g.category] ?? g.category,
				rows: g.nutrients
					.filter((n) => hit.nutrients[n.infoodsTagname] !== undefined)
					.map((n) => ({
						id: n.id,
						name: n.namePl || n.nameEn,
						value: hit.nutrients[n.infoodsTagname],
						unit: n.unit,
					})),
			}))
			.filter((g) => g.rows.length > 0),
	);
	const totalCount = $derived(groups.reduce((sum, g) => sum + g.rows.length, 0));
</script>

{#snippet body()}
	<div class="dchips">
		<Badge>
			<CategoryIcon slug={hit.categorySlug} size={13} />
			{hit.categoryNamePl ?? t("catalog.uncategorized")}
		</Badge>
		<Badge>{SOURCE_BADGE[badgeKey]}</Badge>
		{#if hit.userModified}
			<Badge variant="muted">{t("catalog.edited")}</Badge>
		{/if}
	</div>

	<div class="dhead">
		<div class="nm">{hit.namePl ?? hit.nameEn}</div>
		{#if hit.namePl && hit.namePl !== hit.nameEn}
			<div class="en">{hit.nameEn}</div>
		{/if}
	</div>

	<div class="basis">{t("catalog.profileBasis")}</div>
	<div class="gauges">
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
		<div class="divider"></div>

		<button type="button" class="expand" class:open onclick={() => (open = !open)}>
			<span class="et">{t("catalog.fullProfile")}</span>
			<span class="ec">{totalCount} {t("catalog.nutrientsCount")}</span>
			<svg class="chev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path d="M10 13.5l-4.5-5h9z" />
			</svg>
		</button>

		{#if open}
			{#each groups as group (group.label)}
				<div class="ng">
					<div class="ngh">
						<span class="gt">{group.label}</span>
						<span class="gx">{group.rows.length} {t("catalog.itemsCount")}</span>
					</div>
					{#each group.rows as row (row.id)}
						<div class="nr">
							<span class="k">{row.name}</span>
							<span class="v">{formatAmount(row.value)} {row.unit}</span>
						</div>
					{/each}
				</div>
			{/each}
		{/if}
	{/if}

	<div class="origin">
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fill-rule="evenodd"
				d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"
				clip-rule="evenodd"
			/>
		</svg>
		{ORIGIN[badgeKey]}
	</div>
	{#if SOURCE_ID_LABEL[badgeKey] && hit.sourceId}
		<div class="srcid">
			<span class="sk">{SOURCE_ID_LABEL[badgeKey]}</span>
			<span class="sv">{hit.sourceId}</span>
		</div>
	{/if}
{/snippet}

{#if embedded}
	<div class="detail-body detail-body--embedded">{@render body()}</div>
{:else}
	<Panel variant="thick" class="detail-panel">{@render body()}</Panel>
{/if}

<style>
	:global(.detail-panel) {
		position: sticky;
		top: 18px;
		display: flex;
		flex-direction: column;
		padding: 24px 24px 22px;
		border-radius: var(--radius);
	}
	/* Embedded (inside the Dialog): no glass chrome, no sticky — the dialog is the surface. */
	.detail-body {
		display: flex;
		flex-direction: column;
	}
	.detail-body--embedded {
		padding: 24px 22px 22px;
	}
	.dchips {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 11px;
	}
	.dhead .nm {
		font-size: 1.625rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.15;
		color: var(--foreground);
	}
	.dhead .en {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin-top: 4px;
	}
	.basis {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin: 20px 0 10px;
	}
	.gauges {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-top: 2px;
	}
	.divider {
		height: 1px;
		background: var(--hairline);
		margin: 18px 0;
	}
	.expand {
		width: 100%;
		border: 0;
		background: transparent;
		cursor: pointer;
		font-family: inherit;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 2px;
	}
	.expand:focus-visible {
		outline: none;
		box-shadow: var(--focus);
		border-radius: var(--radius-sm);
	}
	.expand .et {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
	.expand .ec {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
	}
	.expand .chev {
		margin-left: auto;
		width: 17px;
		height: 17px;
		color: var(--muted-foreground);
		transition: transform 0.2s var(--ease);
	}
	.expand.open .chev {
		transform: rotate(180deg);
	}
	.ng {
		margin-top: 8px;
	}
	.ngh {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 9px 2px;
		border-bottom: 1px solid var(--hairline);
	}
	.ngh .gt {
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--foreground);
	}
	.ngh .gx {
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground);
	}
	.nr {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 6px 2px 6px 16px;
	}
	.nr .k {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
	}
	.nr .v {
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
		color: var(--foreground);
	}
	.origin {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		margin-top: 18px;
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.origin svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}
	.srcid {
		display: flex;
		align-items: baseline;
		gap: 7px;
		margin-top: 6px;
		padding-left: 21px;
		font-size: 0.75rem;
	}
	.srcid .sk {
		color: var(--muted-foreground);
	}
	.srcid .sv {
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
		word-break: break-all;
	}
	/* Compact panel on tablet / phone (the modal context below 1200px). */
	@media (max-width: 768px) {
		.detail-body--embedded {
			padding: 20px 16px 16px;
		}
		.dhead .nm {
			font-size: 1.375rem;
		}
		.basis {
			margin: 16px 0 8px;
		}
		.gauges {
			gap: 6px;
		}
	}
	@media (max-width: 380px) {
		.gauges {
			grid-template-columns: repeat(2, 1fr);
			gap: 12px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.expand .chev {
			transition: none;
		}
	}
</style>
