<script lang="ts">
	import { SegmentedToggle } from "$lib/components/ui/segmented";
	import type { FoodCategoryMeta } from "$lib/food/schema";
	import { t } from "$lib/i18n";
	import CategoryIcon from "./CategoryIcon.svelte";
	import { compareCategories, type SourceSegment } from "./meta";

	// Disjunctive facets: the source segmented + category chips. Source is the locked
	// 4-way toolbar (all / USDA / własne / OFF); category is single-select with
	// switchable counts ("Wszystkie" clears it). Counts come from each facet's OWN
	// query, so the active filter never collapses its own chips.
	//
	// `FoodCategoryMeta` lives in the shared `$lib/food/schema` (the client↔server
	// contract) so this component never reaches into `$lib/server/*`.
	type Props = {
		sourceSegment: SourceSegment;
		onSourceChange: (segment: SourceSegment) => void;
		categories: FoodCategoryMeta[];
		counts: Record<string, number>;
		activeCategory: string | null;
		onCategoryChange: (slug: string | null) => void;
	};

	let { sourceSegment, onSourceChange, categories, counts, activeCategory, onCategoryChange }: Props =
		$props();

	const sourceItems = [
		{ value: "all", label: t("catalog.sources.all") },
		{ value: "usda", label: t("catalog.sources.usda") },
		{ value: "custom", label: t("catalog.sources.custom") },
		{ value: "off", label: t("catalog.sources.off") },
	];

	// Only categories with a match in the current (source-filtered) set, grouped so
	// kindred categories sit together rather than alphabetically scattered.
	const visibleCategories = $derived(
		categories
			.filter((c) => (counts[c.slug] ?? 0) > 0)
			.sort((a, b) => compareCategories(a.slug, b.slug)),
	);

	// On narrow desktops the chip row eats vertical space; collapse it behind a toggle
	// that surfaces the active category. Always expanded on wide screens (CSS).
	let expanded = $state(false);
	const activeName = $derived(
		activeCategory === null
			? t("catalog.allCategories")
			: (categories.find((c) => c.slug === activeCategory)?.namePl ?? t("catalog.allCategories")),
	);

	function pick(slug: string | null) {
		onCategoryChange(slug);
		expanded = false;
	}
</script>

<div class="facets">
	<SegmentedToggle
		items={sourceItems}
		value={sourceSegment}
		aria-label={t("catalog.sourceLabel")}
		onValueChange={(v: string) => onSourceChange((v || "all") as SourceSegment)}
	/>

	<div class="catrow">
		<button
			type="button"
			class="cat-toggle"
			class:open={expanded}
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
		>
			<CategoryIcon slug={activeCategory} size={15} />
			<span class="ct-label">{t("catalog.categoryLabel")}:</span>
			<span class="ct-active">{activeName}</span>
			<svg class="chev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path d="M10 13.5l-4.5-5h9z" />
			</svg>
		</button>

		<div class="chips" class:collapsed={!expanded}>
			<span class="clab">{t("catalog.categoryLabel")}</span>
			<button type="button" class="chip" class:on={activeCategory === null} onclick={() => pick(null)}>
				<CategoryIcon slug={null} size={15} />
				{t("catalog.allCategories")}
			</button>
			{#each visibleCategories as cat (cat.slug)}
				<button type="button" class="chip" class:on={activeCategory === cat.slug} onclick={() => pick(cat.slug)}>
					<CategoryIcon slug={cat.slug} size={15} />
					{cat.namePl}
					<span class="n">{counts[cat.slug]}</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.facets {
		display: flex;
		flex-direction: column;
		gap: 13px;
	}
	.catrow {
		min-width: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		align-items: center;
	}
	.clab {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-right: 4px;
	}
	.chip {
		border: 0;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted-foreground);
		background: var(--secondary);
		padding: 6px 12px 6px 9px;
		border-radius: var(--radius-pill);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: background-color 180ms var(--ease), color 180ms var(--ease);
	}
	.chip:hover {
		background: var(--accent);
		color: var(--foreground);
	}
	.chip:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}
	.chip.on {
		background: var(--primary);
		color: var(--primary-foreground);
	}
	.chip .n {
		font-variant-numeric: tabular-nums;
		opacity: 0.6;
		margin-left: 4px;
	}

	/* Collapse toggle: hidden on wide screens; the chip row is always open there. */
	.cat-toggle {
		display: none;
		align-items: center;
		gap: 8px;
		border: 0;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted-foreground);
		background: var(--secondary);
		padding: 7px 12px;
		border-radius: var(--radius-pill);
		cursor: pointer;
	}
	.cat-toggle:hover {
		background: var(--accent);
		color: var(--foreground);
	}
	.cat-toggle:focus-visible {
		outline: none;
		box-shadow: var(--focus);
	}
	.cat-toggle .ct-label {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.cat-toggle .ct-active {
		color: var(--foreground);
	}
	.cat-toggle .chev {
		width: 15px;
		height: 15px;
		transition: transform 0.2s var(--ease);
	}
	.cat-toggle.open .chev {
		transform: rotate(180deg);
	}

	@media (max-width: 1280px) {
		.cat-toggle {
			display: inline-flex;
		}
		.chips {
			margin-top: 9px;
		}
		.chips.collapsed {
			display: none;
		}
		.chips .clab {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.chip,
		.cat-toggle .chev {
			transition: none;
		}
	}
</style>
