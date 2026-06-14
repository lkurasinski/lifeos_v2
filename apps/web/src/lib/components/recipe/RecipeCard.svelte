<script lang="ts">
	import type { RecipeDocument } from "$lib/recipe/schema";
	import { t } from "$lib/i18n";
	import { CARD_MACROS, formatMacro, formatMinutes, difficultyLabel } from "./meta";

	// A scannable recipe card (locked by `browse-detail.html`): thumbnail placeholder ·
	// name · time/meal/difficulty meta · diet badges (incl. "Na zapas") · per-serving
	// kcal + P/C/F macro dots. A NEUTRAL partial-nutrition glyph (never amber — it's a
	// data state, not a result) and a `Szkic` badge when browsing the drafts scope.
	type Props = {
		hit: RecipeDocument;
		selected: boolean;
		/** Slug → Polish label maps for the first meal-type + diet badges. */
		mealTypeLabels: Record<string, string>;
		dietLabels: Record<string, string>;
		onSelect: (id: string) => void;
	};

	let { hit, selected, mealTypeLabels, dietLabels, onSelect }: Props = $props();

	// Draft is read per-row from the doc's authoritative status (not the active scope), so the
	// badge stays correct even if drafts ever become indexable in non-`szkice` scopes.
	const isDraft = $derived(hit.status === "DRAFT");
	const time = $derived(formatMinutes(hit.totalTimeMin ?? null));
	const mealLabel = $derived(
		hit.mealTypeSlugs[0] ? (mealTypeLabels[hit.mealTypeSlugs[0]] ?? null) : null,
	);
	const difficulty = $derived(difficultyLabel(hit.difficulty));
	// Up to two diet/attribute badges (the probe shows two) — resolved to Polish labels.
	const dietBadges = $derived(hit.dietSlugs.slice(0, 2).map((slug) => dietLabels[slug] ?? slug));
	const meta = $derived([time, mealLabel, difficulty].filter((x): x is string => !!x));
</script>

<button type="button" class="rcard" class:on={selected} onclick={() => onSelect(hit.id)}>
	<span class="thumb">
		{#if hit.imageUrl}
			<img src={hit.imageUrl} alt="" loading="lazy" />
		{:else}
			<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M3 10.5h18a8 8 0 0 1-7 7.94V20H10v-1.56A8 8 0 0 1 3 10.5Z" />
				<path
					d="M8.5 7.5c0-1.4 1.2-2.5 1.2-3.5M12 7.5c0-1.4 1.2-2.5 1.2-3.5M15.5 7.5c0-1.4 1.2-2.5 1.2-3.5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
				/>
			</svg>
		{/if}
	</span>

	<div class="rmain">
		<div class="rname">{hit.name}</div>
		<div class="rmeta">
			{#if time}
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm.75 4a.75.75 0 0 0-1.5 0V10c0 .24.11.46.3.6l2.4 1.8a.75.75 0 0 0 .9-1.2l-2.1-1.57V6.5Z"
						clip-rule="evenodd"
					/>
				</svg>
			{/if}
			{#each meta as part, i (i)}
				{#if i > 0}<span class="sepd"></span>{/if}
				<span>{part}</span>
			{/each}
		</div>
		<div class="rbadges">
			{#each dietBadges as label (label)}
				<span class="tag">{label}</span>
			{/each}
			{#if isDraft}
				<span class="tag tag--draft"><span class="pd"></span>{t("recipe.card.draft")}</span>
			{/if}
			{#if !hit.nutritionComplete}
				<span
					class="np"
					title={t("recipe.card.partialNutrition")}
					aria-label={t("recipe.card.partialNutrition")}
				>
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.25 2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"
							clip-rule="evenodd"
						/>
					</svg>
				</span>
			{/if}
		</div>
	</div>

	<div class="rright">
		<div class="rkcal">
			{formatMacro(hit.energyKcalPerServing)}<span class="u">{t("recipe.card.kcalPerServing")}</span
			>
		</div>
		<div class="rmacros">
			{#each CARD_MACROS as m (m.macro)}
				<b><span class="md {m.macro}"></span>{formatMacro(hit[m.field])}</b>
			{/each}
		</div>
	</div>
</button>

<style>
	.rcard {
		display: grid;
		grid-template-columns: 62px minmax(0, 1fr) auto;
		gap: 15px;
		align-items: center;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		background: var(--glass-fill);
		backdrop-filter: blur(var(--blur)) saturate(var(--sat));
		-webkit-backdrop-filter: blur(var(--blur)) saturate(var(--sat));
		border: 0;
		border-radius: var(--radius);
		box-shadow: var(--shadow-soft);
		padding: 13px 16px;
	}
	.rcard:hover {
		background: color-mix(in oklch, var(--card) 60%, transparent);
	}
	.rcard:focus-visible {
		outline: none;
		box-shadow: var(--shadow-soft), var(--focus);
	}
	.rcard.on {
		background: var(--card);
		box-shadow:
			var(--shadow-lift),
			inset 0 0 0 1px var(--hairline);
	}
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.rcard {
			background: var(--card);
		}
	}

	/* Neutral thumbnail placeholder — a photo isn't data, so no identity colour. */
	.thumb {
		width: 62px;
		height: 62px;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
		position: relative;
		overflow: hidden;
		background: linear-gradient(140deg, oklch(0.955 0.012 84), oklch(0.905 0.014 60));
		box-shadow: inset 0 0 0 1px var(--hairline);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.thumb svg {
		width: 26px;
		height: 26px;
		color: oklch(0.66 0.014 70 / 0.55);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.rmain {
		min-width: 0;
	}
	.rname {
		font-size: 0.9375rem;
		font-weight: 550;
		letter-spacing: -0.01em;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--foreground);
	}
	.rmeta {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		margin-top: 2px;
		line-height: 1.3;
		display: flex;
		align-items: center;
		gap: 7px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rmeta svg {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		margin-right: -3px;
		opacity: 0.85;
	}
	.rmeta .sepd {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.4;
		flex-shrink: 0;
	}
	.rbadges {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		flex-wrap: wrap;
	}
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		background: var(--secondary);
		padding: 3px 8px;
		border-radius: var(--radius-pill);
	}
	.tag--draft {
		color: var(--foreground);
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.tag--draft .pd {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--muted-foreground);
	}
	@media (prefers-reduced-motion: no-preference) {
		.tag--draft .pd {
			animation: pulse 2s var(--ease) infinite;
		}
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 0.9;
		}
	}
	/* Partial-data marker — NEUTRAL graphite (a data state, not a result). */
	.np {
		display: inline-flex;
		align-items: center;
		color: var(--muted-foreground);
	}
	.np svg {
		width: 14px;
		height: 14px;
	}

	.rright {
		text-align: right;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 5px;
		flex-shrink: 0;
		padding-left: 4px;
	}
	.rkcal {
		font-weight: 300;
		letter-spacing: -0.02em;
		font-size: 1.4375rem;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
	}
	.rkcal .u {
		font-size: 0.5rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		display: block;
		margin-top: 3px;
	}
	.rmacros {
		display: flex;
		gap: 10px;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
	}
	.rmacros b {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-weight: 400;
	}
	/* Macro dots carry the locked macro-identity hue (colour = WHICH macro). */
	.md {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.md.pro {
		background: oklch(0.6 0.12 245);
	}
	.md.carb {
		background: oklch(0.66 0.1 182);
	}
	.md.fat {
		background: oklch(0.8 0.13 92);
	}
</style>
