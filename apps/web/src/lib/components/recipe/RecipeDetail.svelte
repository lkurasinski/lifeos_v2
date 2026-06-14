<script lang="ts">
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import { Chip } from "$lib/components/ui/chip";
	import { Gauge } from "$lib/components/ui/gauge";
	import { Panel } from "$lib/components/ui/panel";
	import NutrientGroupSection from "$lib/components/catalog/NutrientGroupSection.svelte";
	import { groupRegistryRows } from "$lib/components/catalog/meta";
	import type { NutrientRegistryGroup } from "$lib/food/schema";
	import type { RecipeComponentView, RecipeDetailView, SubComponentView } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import {
		formatAmount,
		formatComponentQty,
		formatMinutes,
		macroPct,
		difficultyLabel,
		recipeMacroGauges,
		totalTime,
		MACRO_TAG_SET,
	} from "./meta";
	import { buildStepStages, countNumberedSteps } from "./steps";

	// The recipe detail panel (locked by `browse-detail.html` / `-complex.html`): header
	// chips → meta → per-serving macro gauges → honest partial-data banner (names the
	// offending component) → ingredients (sub-recipes expand inline) → step stages (derived
	// from sub-recipe composition; wait-steps as passive blocks) → tips → full-profile
	// expander → owner actions + the in-use delete-block note. Reads the cached profile from
	// Postgres (the `RecipeDetailView`) — never Meili. Mirrors `ProductDetail` chrome.
	type Props = {
		recipe: RecipeDetailView;
		registry: NutrientRegistryGroup[];
		/** When true, drop the glass Panel chrome — the host (a Dialog) is the surface. */
		embedded?: boolean;
		/** Owner edit affordance — the host routes to /recipes/[id]/edit. Hidden when omitted. */
		onEdit?: (recipe: RecipeDetailView) => void;
		/** Owner delete affordance — the host opens the confirm step. Hidden when omitted. */
		onDelete?: (recipe: RecipeDetailView) => void;
	};

	let { recipe, registry, embedded = false, onEdit, onDelete }: Props = $props();

	const totalTimeMin = $derived(totalTime(recipe.prepTimeMin, recipe.cookTimeMin));
	const timeLabel = $derived(formatMinutes(totalTimeMin));
	const difficulty = $derived(difficultyLabel(recipe.difficulty));
	const visibilityLabel = $derived(
		recipe.visibility === "PUBLIC" ? t("recipe.detail.public") : t("recipe.detail.private"),
	);

	// Per-serving macro rings — value from the cached per-serving fields (absent = "—", NULL≠0).
	const gauges = $derived(
		recipeMacroGauges().map((g) => {
			const value = recipe[g.field] ?? undefined;
			return { ...g, value };
		}),
	);

	const componentCount = $derived(recipe.components.length);

	// Full nutrient profile (per serving), grouped by registry category via the shared
	// `groupRegistryRows`. Reads the server-computed `perServing` map (single source of truth) —
	// never re-divides totals here. The four macros are already shown as gauges, so exclude them.
	const profileGroups = $derived(groupRegistryRows(registry, recipe.perServing, MACRO_TAG_SET));
	const profileCount = $derived(profileGroups.reduce((sum, g) => sum + g.rows.length, 0));
	let profileOpen = $state(false);

	// Sub-recipe rows expand inline (open by default, like the probe).
	let collapsed = $state<Record<string, boolean>>({});
	const isOpen = (id: string) => collapsed[id] !== true;

	// The component instance is reused as the selection changes — reset the local disclosure
	// state when the recipe switches, so a panel opened on one recipe doesn't carry over.
	// svelte-ignore state_referenced_locally
	let lastId = recipe.id;
	$effect(() => {
		if (recipe.id !== lastId) {
			lastId = recipe.id;
			profileOpen = false;
			collapsed = {};
		}
	});

	// ─── Step stages (derived presentation) ──────────────────────────────────────
	// Sub-recipe steps → titled stages, parent steps → assembly/flat list; see `steps.ts`
	// for the locked shape rules. Pure + unit-tested there (`steps.test.ts`).
	const stages = $derived(buildStepStages(recipe));
	const totalSteps = $derived(countNumberedSteps(stages));

	/** Display text for a parent component's amount (products + sub-recipes use the same fn). */
	function qty(c: RecipeComponentView | SubComponentView) {
		return formatComponentQty(c.amount, c.unit, c.gramsResolved);
	}
	function componentName(c: RecipeComponentView | SubComponentView): string {
		if ("subRecipe" in c && c.subRecipe) return c.subRecipe.name;
		if ("subRecipeName" in c && c.subRecipeName) return c.subRecipeName;
		return c.product ? (c.product.namePl ?? c.product.nameEn) : t("recipe.detail.unknownComponent");
	}
</script>

{#snippet qtyText(c: RecipeComponentView | SubComponentView)}
	{@const q = qty(c)}
	<span class="cqty" class:missing={q.missing}>
		{q.main}{#if q.clarifier}<i>{q.clarifier}</i>{/if}
	</span>
{/snippet}

{#snippet nestIcon()}
	<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
		<path
			d="M4 3.6A1.6 1.6 0 0 1 5.6 2H10v15.4l-.9-.5a3 3 0 0 0-1.5-.4H5.6A1.6 1.6 0 0 1 4 14.9V3.6Z"
		/>
		<path
			d="M16 3.6A1.6 1.6 0 0 0 14.4 2H10v15.4l.9-.5a3 3 0 0 1 1.5-.4h2A1.6 1.6 0 0 0 16 14.9V3.6Z"
			opacity=".5"
		/>
	</svg>
{/snippet}

{#snippet body()}
	<div class="dchips">
		{#each recipe.mealTypes as mt (mt.id)}
			<Badge>{mt.namePl}</Badge>
		{/each}
		{#if recipe.cuisine}
			<Badge>{recipe.cuisine.namePl}</Badge>
		{/if}
		<Badge variant="outline">{visibilityLabel}</Badge>
		{#if recipe.status === "DRAFT"}
			<Badge variant="outline">{t("recipe.card.draft")}</Badge>
		{/if}
	</div>

	<div class="dhead">
		<div class="nm">{recipe.name}</div>
		{#if recipe.description}
			<div class="desc">{recipe.description}</div>
		{/if}
	</div>

	<div class="dmeta">
		{#if timeLabel}
			<span class="dm">
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
					><path
						fill-rule="evenodd"
						d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm.75 4a.75.75 0 0 0-1.5 0V10c0 .24.11.46.3.6l2.4 1.8a.75.75 0 0 0 .9-1.2l-2.1-1.57V6.5Z"
						clip-rule="evenodd"
					/></svg
				>
				<b>{timeLabel}</b><span class="ml">{t("recipe.detail.totalTime")}</span>
			</span>
		{/if}
		{#if difficulty}
			<span class="dm">
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
					><path
						d="M3 13.5a7 7 0 0 1 14 0 .75.75 0 0 1-.75.75H3.75A.75.75 0 0 1 3 13.5Z"
						opacity=".4"
					/><path d="M10 13.25 13.4 8a.6.6 0 0 0-.84-.82L10 11.9a1.3 1.3 0 1 0 0 1.35Z" /></svg
				>
				<b>{difficulty}</b>
			</span>
		{/if}
		<span class="dm">
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
				><path
					d="M10 3.2c-3.6 0-6.6 2.3-7 5.3-.05.4.27.74.67.74h12.66c.4 0 .72-.34.67-.74-.4-3-3.4-5.3-7-5.3Z"
				/><rect x="2.5" y="10.6" width="15" height="2.2" rx="1.1" /></svg
			>
			<b>{recipe.servings}</b><span class="ml">{t("recipe.detail.servings")}</span>
		</span>
	</div>

	{#if recipe.techniques.length > 0}
		<div class="dtech">
			<span class="tl">{t("recipe.facets.technique")}</span>
			{#each recipe.techniques as tech (tech.id)}
				<Chip variant="tag">{tech.namePl}</Chip>
			{/each}
		</div>
	{/if}

	{#if recipe.diets.length > 0}
		<div class="dtech">
			<span class="tl">{t("recipe.facets.diet")}</span>
			{#each recipe.diets as diet (diet.id)}
				<Chip variant="tag">{diet.namePl}</Chip>
			{/each}
		</div>
	{/if}

	{#if recipe.allergens.length > 0}
		<div class="dtech">
			<span class="tl">{t("recipe.facets.allergen")}</span>
			{#each recipe.allergens as allergen (allergen.id)}
				<Chip variant="tag">{allergen.namePl}</Chip>
			{/each}
		</div>
	{/if}

	<div class="basis">
		{t("recipe.detail.nutritionTitle")}
		<span class="pp"
			>· {t("recipe.detail.perServing")} ({t("recipe.detail.ofServings")} {recipe.servings})</span
		>
	</div>
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

	{#if !recipe.nutritionComplete && recipe.incompleteComponents.length > 0}
		<div class="honest">
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
				><path
					fill-rule="evenodd"
					d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"
					clip-rule="evenodd"
				/></svg
			>
			<p>
				<b>{t("recipe.detail.partialTitle")}</b>
				{t("recipe.detail.partialIntro")}
				{#each recipe.incompleteComponents as ic, i (`${ic.kind}:${ic.refId}`)}{i > 0
						? ", "
						: " "}„{ic.name}"{/each}.
				{t("recipe.detail.partialOutro")}
			</p>
		</div>
	{/if}

	<div class="divider"></div>

	<div class="sec-h">
		{t("recipe.detail.ingredients")}
		<span class="ct"
			>{componentCount}
			{t("recipe.detail.itemsCount")} · {t("recipe.detail.forServings")}
			{recipe.servings}
			{t("recipe.detail.servings")}</span
		>
	</div>
	<div class="comp">
		{#each recipe.components as c (c.id)}
			{#if c.subRecipe}
				<div class="citem">
					<button
						type="button"
						class="crow shead"
						class:open={isOpen(c.id)}
						aria-expanded={isOpen(c.id)}
						onclick={() => (collapsed[c.id] = isOpen(c.id))}
					>
						<svg class="chev2" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
							><path d="M10 13.5l-4.5-5h9z" /></svg
						>
						<span class="cname">
							{c.subRecipe.name}
							<span class="subtag">{@render nestIcon()}{t("recipe.detail.subRecipeTag")}</span>
						</span>
						{@render qtyText(c)}
					</button>
					{#if isOpen(c.id)}
						<div class="subitems">
							{#each c.subRecipe.components as sc (sc.id)}
								{@const sq = qty(sc)}
								<div class="subrow">
									<span class="sn">
										{componentName(sc)}{#if sq.missing}<span
												class="star"
												title={t("recipe.detail.noData")}>*</span
											>{/if}
									</span>
									<span class="sq" class:missing={sq.missing}
										>{sq.main}{#if sq.clarifier}<i>{sq.clarifier}</i>{/if}</span
									>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<div class="crow">
					<span class="cmk"></span>
					<span class="cname">{componentName(c)}</span>
					{@render qtyText(c)}
				</div>
			{/if}
		{:else}
			<p class="emptyline">{t("recipe.detail.noIngredients")}</p>
		{/each}
	</div>

	{#if stages.length > 0}
		<div class="divider"></div>
		<div class="sec-h">
			{t("recipe.detail.preparation")}
			<span class="ct">{totalSteps} {t("recipe.detail.stepsCount")}</span>
		</div>
		<div class="stages">
			{#each stages as stage (stage.key)}
				<div class="stage">
					{#if stage.title}
						<div class="sg-head">
							<span class="sg-icon">{@render nestIcon()}</span>
							<span class="sg-name">{stage.title}</span>
							{#if stage.timeLabel}<span class="sg-time">~{stage.timeLabel}</span>{/if}
						</div>
					{/if}
					<div class="steps">
						{#each stage.items as item (item.key)}
							{#if item.step.kind === "wait"}
								<div class="waitblock">
									<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
										><path
											fill-rule="evenodd"
											d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm.75 4a.75.75 0 0 0-1.5 0V10c0 .24.11.46.3.6l2.4 1.8a.75.75 0 0 0 .9-1.2l-2.1-1.57V6.5Z"
											clip-rule="evenodd"
										/></svg
									>
									<span class="wtext">{item.step.text}</span>
									<span class="wdur">{formatMinutes(item.step.durationMin)}</span>
								</div>
							{:else}
								<div class="step">
									<span class="snum">{item.num}</span>
									<p class="stext">{item.step.text}</p>
									{#if item.step.imageUrl}
										<img class="sthumb" src={item.step.imageUrl} alt="" loading="lazy" />
									{/if}
								</div>
							{/if}
						{/each}
					</div>
					{#if stage.omittedSubSteps.length > 0}
						<p class="omit">
							{t("recipe.detail.nestedStepsOmitted")}
							{stage.omittedSubSteps.join(", ")}
						</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if recipe.tips.length > 0}
		<div class="divider"></div>
		<div class="sec-h">{t("recipe.detail.tips")}</div>
		<div class="tips">
			{#each recipe.tips as tip, i (i)}
				<div class="tip">
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
						><path
							d="M10 2.2a5.3 5.3 0 0 0-3.2 9.5c.5.4.8.9.9 1.5l.1.8h4.4l.1-.8c.1-.6.4-1.1.9-1.5A5.3 5.3 0 0 0 10 2.2Z"
						/><path
							d="M7.7 16.2h4.6M8.4 17.8h3.2"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
						/></svg
					>
					<span>{tip}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if profileCount > 0}
		<div class="divider"></div>
		<button
			type="button"
			class="expand"
			class:open={profileOpen}
			aria-expanded={profileOpen}
			onclick={() => (profileOpen = !profileOpen)}
		>
			<span class="et">{t("recipe.detail.fullProfile")}</span>
			<span class="ec"
				>{t("recipe.detail.perServing")} · {profileCount} {t("recipe.detail.nutrientsCount")}</span
			>
			<svg class="chev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
				><path d="M10 13.5l-4.5-5h9z" /></svg
			>
		</button>
		{#if profileOpen}
			{#each profileGroups as group (group.label)}
				<NutrientGroupSection
					label={group.label}
					count={`${group.rows.length} ${t("recipe.detail.itemsCount")}`}
				>
					{#each group.rows as row (row.id)}
						<div class="prow">
							<span class="pn">{row.name}</span>
							<span class="pv">{formatAmount(row.value)} {row.unit}</span>
						</div>
					{/each}
				</NutrientGroupSection>
			{/each}
		{/if}
	{/if}

	{#if onEdit || onDelete}
		<div class="dactions">
			{#if onDelete}
				<Button variant="secondary" onclick={() => onDelete?.(recipe)}>{t("common.delete")}</Button>
			{/if}
			{#if onEdit}
				<Button class="flex-1" onclick={() => onEdit?.(recipe)}>
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
						><path
							d="M13.94 3.31a1.75 1.75 0 0 1 2.475 2.475l-8.3 8.3a2 2 0 0 1-.86.503l-2.74.76a.75.75 0 0 1-.922-.923l.76-2.74a2 2 0 0 1 .503-.86l8.3-8.3Z"
						/></svg
					>
					{t("recipe.detail.editRecipe")}
				</Button>
			{/if}
		</div>
		{#if recipe.usedInCount > 0}
			<div class="usage">
				{@render nestIcon()}
				{t("recipe.detail.usedInPrefix")}
				<b>{recipe.usedInCount} {t("recipe.detail.usedInRecipes")}</b>
				{t("recipe.detail.usedInSuffix")}
			</div>
		{/if}
	{/if}
{/snippet}

{#if embedded}
	<!-- Embedded (inside the Dialog): no glass chrome — the dialog is the surface. -->
	<div class="flex flex-col px-[22px] pb-[22px] pt-6 max-md:px-4 max-md:pb-[18px] max-md:pt-5">
		{@render body()}
	</div>
{:else}
	<!-- Layout (padding/flex) lives in global Tailwind utilities, NOT a scoped class:
	     a scoped class passed to the Panel component never receives this component's
	     style hash, so it would silently fail to apply (mirrors ProductDetail). -->
	<Panel
		variant="thick"
		class="sticky top-[18px] flex flex-col px-6 pb-[22px] pt-6 max-md:px-4 max-md:pb-[18px] max-md:pt-5"
	>
		{@render body()}
	</Panel>
{/if}

<style>
	.dchips {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 11px;
		flex-wrap: wrap;
	}
	.dhead .nm {
		font-size: 1.625rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.15;
		color: var(--foreground);
	}
	@media (max-width: 768px) {
		.dhead .nm {
			font-size: 1.375rem;
		}
	}
	.dhead .desc {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin-top: 6px;
		line-height: 1.5;
		max-width: 62ch;
	}

	.dmeta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 18px;
		margin-top: 16px;
	}
	.dm {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 0.8125rem;
		color: var(--foreground);
	}
	.dm svg {
		width: 16px;
		height: 16px;
		color: var(--muted-foreground);
		flex-shrink: 0;
	}
	.dm b {
		font-weight: 550;
	}
	.dm .ml {
		color: var(--muted-foreground);
		font-size: 0.6875rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-left: 1px;
	}

	.dtech {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 7px;
		margin-top: 16px;
	}
	.dtech .tl {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-right: 2px;
	}

	.basis {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin: 22px 0 12px;
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.basis .pp {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
	}
	.gauges {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-top: 2px;
	}
	@media (max-width: 380px) {
		.gauges {
			grid-template-columns: repeat(2, 1fr);
			gap: 14px;
		}
	}

	.honest {
		display: flex;
		align-items: flex-start;
		gap: 9px;
		margin-top: 16px;
		padding: 10px 13px;
		border-radius: var(--radius-sm);
		background: var(--secondary);
		color: var(--muted-foreground);
	}
	.honest svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		margin-top: 1px;
	}
	.honest p {
		font-size: 0.75rem;
		line-height: 1.45;
	}
	.honest b {
		color: var(--foreground);
		font-weight: 550;
	}

	.divider {
		height: 1px;
		background: var(--hairline);
		margin: 20px 0;
	}
	.sec-h {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-bottom: 11px;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}
	.sec-h .ct {
		text-transform: none;
		letter-spacing: 0;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
		text-align: right;
		flex-shrink: 0;
	}

	/* ingredients */
	.comp {
		display: flex;
		flex-direction: column;
	}
	.crow {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 8px 2px;
		border-bottom: 1px solid var(--hairline);
		width: 100%;
		text-align: left;
	}
	.comp > .crow:last-child,
	.comp > .citem:last-child .crow {
		border-bottom: 0;
	}
	.cmk {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--muted-foreground);
		flex-shrink: 0;
		transform: translateY(-3px);
		opacity: 0.5;
	}
	.cname {
		flex: 1;
		min-width: 0;
		font-size: 0.875rem;
		color: var(--foreground);
		line-height: 1.35;
	}
	.subtag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		background: var(--accent);
		padding: 2px 7px;
		border-radius: var(--radius-pill);
		margin-left: 7px;
		vertical-align: 1px;
	}
	.subtag svg {
		width: 11px;
		height: 11px;
	}
	.cqty {
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
		white-space: nowrap;
		text-align: right;
	}
	.cqty i,
	.sq i {
		font-style: normal;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		margin-left: 6px;
	}
	.cqty.missing i,
	.sq.missing i {
		color: var(--muted-foreground);
		font-style: italic;
	}

	/* sub-recipe expandable header + nested rows */
	.citem {
		border-bottom: 1px solid var(--hairline);
	}
	.crow.shead {
		border-bottom: 0;
		cursor: pointer;
		background: transparent;
		border-left: 0;
		border-right: 0;
		border-top: 0;
		font-family: inherit;
		align-items: center;
	}
	.crow.shead:focus-visible {
		outline: none;
		box-shadow: var(--focus);
		border-radius: var(--radius-sm);
	}
	.chev2 {
		width: 16px;
		height: 16px;
		color: var(--muted-foreground);
		flex-shrink: 0;
		transform: rotate(-90deg);
		transition: transform 0.2s var(--ease);
	}
	.crow.shead.open .chev2 {
		transform: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.chev2 {
			transition: none;
		}
	}
	.subitems {
		display: flex;
		flex-direction: column;
		padding: 2px 2px 10px 26px;
	}
	.subrow {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		padding: 5px 0;
	}
	.sn {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		min-width: 0;
	}
	.star {
		color: var(--muted-foreground);
		margin-left: 3px;
	}
	.sq {
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
		white-space: nowrap;
		text-align: right;
	}
	.emptyline {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		padding: 4px 2px;
	}

	/* steps + stages */
	.stages {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.sg-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 11px;
	}
	.sg-icon {
		display: inline-flex;
		color: var(--muted-foreground);
	}
	.sg-icon svg {
		width: 16px;
		height: 16px;
	}
	.sg-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--foreground);
	}
	.sg-time {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
	}
	.steps {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.step {
		display: grid;
		grid-template-columns: 26px minmax(0, 1fr) auto;
		gap: 13px;
		align-items: start;
	}
	.snum {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--secondary);
		color: var(--foreground);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8125rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}
	.stext {
		font-size: 0.875rem;
		color: var(--foreground);
		line-height: 1.5;
	}
	.sthumb {
		width: 52px;
		height: 52px;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
		object-fit: cover;
		box-shadow: inset 0 0 0 1px var(--hairline);
	}
	.waitblock {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 13px;
		border-radius: var(--radius-sm);
		background: var(--secondary);
		color: var(--muted-foreground);
	}
	.waitblock svg {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
	}
	.waitblock .wtext {
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		line-height: 1.4;
	}
	.waitblock .wdur {
		font-size: 0.75rem;
		font-weight: 550;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.omit {
		margin-top: 11px;
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	/* tips */
	.tips {
		display: flex;
		flex-direction: column;
		gap: 9px;
	}
	.tip {
		display: flex;
		gap: 9px;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		line-height: 1.5;
	}
	.tip svg {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		margin-top: 2px;
	}

	/* full profile expander */
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
	@media (prefers-reduced-motion: reduce) {
		.expand .chev {
			transition: none;
		}
	}
	.prow {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 6px 2px 6px 16px;
	}
	.pn {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
	}
	.pv {
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
		color: var(--foreground);
	}

	/* owner actions + in-use note */
	.dactions {
		display: flex;
		gap: 10px;
		margin-top: 24px;
	}
	.usage {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		margin-top: 14px;
		display: flex;
		align-items: center;
		gap: 7px;
		flex-wrap: wrap;
	}
	.usage :global(svg) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}
	.usage b {
		color: var(--foreground);
		font-weight: 550;
	}
</style>
