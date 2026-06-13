<script lang="ts">
	import type { Snippet } from "svelte";
	import { Chip } from "$lib/components/ui/chip";
	import { SegmentedToggle } from "$lib/components/ui/segmented";
	import type { RecipeScope, RecipeSearchResult, TaxonomyView } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import { difficultyOptions } from "./meta";

	// The browse toolbar (locked by `browse-detail.html`): a 4-way scope segment
	// (Wszystkie/Moje/Publiczne/Szkice N) over multi-select facet chips. `Posiłek` + `Dieta`
	// are always visible; technika/alergeny/kuchnia/trudność hide behind a `Więcej filtrów`
	// overflow. Counts come from each facet's OWN disjunctive query (an active selection in
	// one dimension never collapses that dimension's own chips).
	export type FacetDim = "mealTypes" | "diets" | "allergens" | "techniques" | "cuisines" | "difficulties";

	type Props = {
		scope: RecipeScope;
		draftCount: number;
		onScopeChange: (scope: RecipeScope) => void;
		mealTypes: TaxonomyView[];
		diets: TaxonomyView[];
		allergens: TaxonomyView[];
		techniques: TaxonomyView[];
		cuisines: TaxonomyView[];
		facets: RecipeSearchResult["facets"];
		active: Record<FacetDim, string[]>;
		onToggle: (dim: FacetDim, value: string) => void;
		onClear: (dim: FacetDim) => void;
	};

	let {
		scope,
		draftCount,
		onScopeChange,
		mealTypes,
		diets,
		allergens,
		techniques,
		cuisines,
		facets,
		active,
		onToggle,
		onClear,
	}: Props = $props();

	const scopeItems = $derived([
		{ value: "wszystkie", label: t("recipe.scope.all") },
		{ value: "moje", label: t("recipe.scope.mine") },
		{ value: "publiczne", label: t("recipe.scope.public") },
		{ value: "szkice", label: draftCount > 0 ? `${t("recipe.scope.drafts")} ${draftCount}` : t("recipe.scope.drafts") },
	]);

	type ChipItem = { value: string; label: string };
	type Group = { dim: FacetDim; label: string; items: ChipItem[]; counts: Record<string, number>; active: string[] };

	/** Build a chip group: only items with a hit (count > 0) or already-selected stay visible. */
	function group(dim: FacetDim, label: string, items: ChipItem[], counts: Record<string, number>): Group {
		const act = active[dim];
		const visible = items.filter((it) => (counts[it.value] ?? 0) > 0 || act.includes(it.value));
		return { dim, label, items: visible, counts, active: act };
	}

	const taxItems = (rows: TaxonomyView[]): ChipItem[] => rows.map((r) => ({ value: r.slug, label: r.namePl }));

	const mealGroup = $derived(group("mealTypes", t("recipe.facets.meal"), taxItems(mealTypes), facets.mealTypeSlugs));
	const dietGroup = $derived(group("diets", t("recipe.facets.diet"), taxItems(diets), facets.dietSlugs));
	const overflowGroups = $derived([
		group("techniques", t("recipe.facets.technique"), taxItems(techniques), facets.techniqueSlugs),
		group("allergens", t("recipe.facets.allergen"), taxItems(allergens), facets.allergenSlugs),
		group("cuisines", t("recipe.facets.cuisine"), taxItems(cuisines), facets.cuisineSlug),
		group("difficulties", t("recipe.facets.difficulty"), difficultyOptions(), facets.difficulty),
	]);

	let showMore = $state(false);
	// The overflow is open when the user expanded it OR any of its dimensions carries an active
	// selection (so a filtered facet is never hidden). One derived drives both render + the
	// toggle, so clicking always flips the *effective* state (never a visible no-op).
	const overflowActive = $derived(overflowGroups.some((g) => g.active.length > 0));
	const expanded = $derived(showMore || overflowActive);
</script>

{#snippet chipGroup(g: Group, trailing?: Snippet)}
	<div class="flex flex-wrap items-center gap-[7px]">
		<span class="mr-1 w-[60px] shrink-0 text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground max-md:w-auto">
			{g.label}
		</span>
		<Chip active={g.active.length === 0} onclick={() => onClear(g.dim)}>
			{t("recipe.facets.allOption")}
		</Chip>
		{#each g.items as item (item.value)}
			<Chip
				active={g.active.includes(item.value)}
				count={g.counts[item.value]}
				onclick={() => onToggle(g.dim, item.value)}
			>
				{item.label}
			</Chip>
		{/each}
		{#if trailing}{@render trailing()}{/if}
	</div>
{/snippet}

{#snippet moreToggle()}
	<Chip variant="ghost" aria-expanded={expanded} onclick={() => (showMore = !expanded)}>
		{t("recipe.facets.more")}
	</Chip>
{/snippet}

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-4">
		<SegmentedToggle
			items={scopeItems}
			value={scope}
			aria-label={t("recipe.scope.label")}
			onValueChange={(v: string) => onScopeChange((v || "wszystkie") as RecipeScope)}
		/>
	</div>

	<!-- Facets only apply to the Meili-backed scopes; drafts (Postgres) carry none. -->
	{#if scope !== "szkice"}
		{@render chipGroup(mealGroup)}
		<!-- The diet group renders through the shared snippet, with the overflow toggle as its trailing chip. -->
		{@render chipGroup(dietGroup, moreToggle)}

		{#if expanded}
			{#each overflowGroups as g (g.dim)}
				{@render chipGroup(g)}
			{/each}
		{/if}
	{/if}
</div>
