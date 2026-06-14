<script lang="ts">
	import { Chip } from "$lib/components/ui/chip";
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

<div class="flex flex-col gap-[13px]">
	<SegmentedToggle
		items={sourceItems}
		value={sourceSegment}
		aria-label={t("catalog.sourceLabel")}
		onValueChange={(v: string) => onSourceChange((v || "all") as SourceSegment)}
	/>

	<div class="min-w-0">
		<!-- Collapse toggle: hidden on wide screens (the chip row is always open there). -->
		<button
			type="button"
			class="hidden items-center gap-2 rounded-pill border-0 bg-secondary px-3 py-[7px] text-[0.8125rem] font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:shadow-[var(--focus)] focus-visible:outline-none max-xl:inline-flex"
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
		>
			<CategoryIcon slug={activeCategory} size={15} />
			<span class="text-[0.625rem] font-medium uppercase tracking-[0.06em]">{t("catalog.categoryLabel")}:</span>
			<span class="text-foreground">{activeName}</span>
			<svg
				class="h-[15px] w-[15px] transition-transform duration-200 ease-[var(--ease)] motion-reduce:transition-none {expanded
					? 'rotate-180'
					: ''}"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path d="M10 13.5l-4.5-5h9z" />
			</svg>
		</button>

		<div
			class={[
				"flex flex-wrap items-center gap-[7px] max-xl:mt-[9px]",
				!expanded && "max-xl:hidden",
			]}
		>
			<span class="mr-1 text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground max-xl:hidden">
				{t("catalog.categoryLabel")}
			</span>
			<Chip active={activeCategory === null} onclick={() => pick(null)}>
				{#snippet leading()}<CategoryIcon slug={null} size={15} />{/snippet}
				{t("catalog.allCategories")}
			</Chip>
			{#each visibleCategories as cat (cat.slug)}
				<Chip active={activeCategory === cat.slug} count={counts[cat.slug]} onclick={() => pick(cat.slug)}>
					{#snippet leading()}<CategoryIcon slug={cat.slug} size={15} />{/snippet}
					{cat.namePl}
				</Chip>
			{/each}
		</div>
	</div>
</div>
