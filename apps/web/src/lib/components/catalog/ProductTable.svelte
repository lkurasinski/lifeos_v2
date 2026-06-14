<script lang="ts">
	import type { FoodDocument, SortKey } from "$lib/food/schema";
	import { t } from "$lib/i18n";
	import { Badge } from "$lib/components/ui/badge";
	import CategoryIcon from "./CategoryIcon.svelte";
	import { formatMacro, sourceBadgeKey } from "./meta";

	// Master list — the locked catalog table with sortable column headers (sort lives
	// in the header, no dedicated control). Rows compose the category glyph + a source
	// badge; macros are the top-level doc fields, with an em dash for absent (NULL≠0).
	type Props = {
		hits: FoodDocument[];
		sort: SortKey;
		dir: "asc" | "desc";
		selectedId: string | null;
		onSort: (key: SortKey) => void;
		onSelect: (id: string) => void;
	};

	let { hits, sort, dir, selectedId, onSort, onSelect }: Props = $props();

	const SOURCE_BADGE: Record<"usda" | "custom" | "off", string> = {
		usda: t("catalog.sourceBadge.usda"),
		custom: t("catalog.sourceBadge.custom"),
		off: t("catalog.sourceBadge.off"),
	};

	// `cls` marks the columns that toggle across breakpoints (kcal is always shown).
	const numericCols: { key: SortKey; label: string; cls: string }[] = [
		{ key: "kcal", label: t("catalog.columns.kcal"), cls: "" },
		{ key: "protein", label: t("catalog.columns.protein"), cls: "c-pro" },
		{ key: "carbs", label: t("catalog.columns.carbs"), cls: "c-carb" },
		{ key: "fat", label: t("catalog.columns.fat"), cls: "c-fat" },
	];
</script>

<div
	class="listhead cols grid items-end gap-[14px] px-[18px] pb-[11px] pt-0.5 max-md:px-[14px] max-md:pb-2.5"
>
	<button
		type="button"
		class={[
			"inline-flex items-center gap-[5px] border-0 bg-transparent p-0 text-[0.625rem] font-medium uppercase tracking-[0.06em] focus-visible:text-foreground focus-visible:outline-none",
			sort === "name"
				? "font-semibold text-foreground"
				: "text-muted-foreground hover:text-foreground",
		]}
		onclick={() => onSort("name")}
	>
		{t("catalog.columns.product")}
		<svg
			class="h-[13px] w-[13px] shrink-0 {sort === 'name' ? '' : 'opacity-0'}"
			viewBox="0 0 20 20"
			fill="currentColor"
			aria-hidden="true"
		>
			<path d={sort === "name" && dir === "asc" ? "M10 6l3.5 4h-7z" : "M10 14l-3.5-4h7z"} />
		</svg>
	</button>
	<span
		class="c-cat inline-flex cursor-default items-center gap-[5px] text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground"
		>{t("catalog.columns.category")}</span
	>
	<span
		class="c-src inline-flex cursor-default items-center gap-[5px] text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground"
		>{t("catalog.columns.source")}</span
	>
	{#each numericCols as col (col.key)}
		<button
			type="button"
			class={[
				"inline-flex items-center justify-end gap-[5px] border-0 bg-transparent p-0 text-[0.625rem] font-medium uppercase tracking-[0.06em] focus-visible:text-foreground focus-visible:outline-none",
				col.cls,
				sort === col.key
					? "font-semibold text-foreground"
					: "text-muted-foreground hover:text-foreground",
			]}
			onclick={() => onSort(col.key)}
		>
			{col.label}
			<svg
				class="h-[13px] w-[13px] shrink-0 {sort === col.key ? '' : 'opacity-0'}"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path d={sort === col.key && dir === "asc" ? "M10 6l3.5 4h-7z" : "M10 14l-3.5-4h7z"} />
			</svg>
		</button>
	{/each}
</div>

<div class="flex flex-col gap-2">
	{#each hits as hit (hit.id)}
		{@const badge = sourceBadgeKey(hit.source)}
		<button
			type="button"
			class="prow cols"
			class:on={selectedId === hit.id}
			onclick={() => onSelect(hit.id)}
		>
			<div class="flex min-w-0 items-center gap-[11px]">
				{#if hit.imageThumbUrl ?? hit.imageUrl}
					<img
						class="h-[34px] w-[34px] shrink-0 rounded-[8px] bg-secondary object-cover"
						src={hit.imageThumbUrl ?? hit.imageUrl}
						alt=""
						loading="lazy"
					/>
				{/if}
				<div class="min-w-0">
					<div
						class="truncate text-[0.9375rem] font-[550] leading-[1.25] tracking-[-0.01em] text-foreground"
					>
						{hit.namePl ?? hit.nameEn}
					</div>
					{#if hit.brand}
						<div class="mt-px truncate text-xs leading-[1.2] text-muted-foreground">
							{hit.brand}
						</div>
					{/if}
				</div>
			</div>
			<span class="c-cat flex items-center" title={hit.categoryNamePl ?? ""}>
				<CategoryIcon slug={hit.categorySlug} size={18} />
			</span>
			<span class="c-src inline-flex items-center justify-self-start"
				><Badge>{SOURCE_BADGE[badge]}</Badge></span
			>
			<span
				class="text-right text-[1.3125rem] font-light leading-none tracking-[-0.02em] tabular-nums text-foreground"
				>{formatMacro(hit.energyKcal)}</span
			>
			<span class="c-pro text-right text-[0.9375rem] tabular-nums text-foreground"
				>{formatMacro(hit.protein)}</span
			>
			<span class="c-carb text-right text-[0.9375rem] tabular-nums text-foreground"
				>{formatMacro(hit.carbs)}</span
			>
			<span class="c-fat text-right text-[0.9375rem] tabular-nums text-foreground"
				>{formatMacro(hit.fat)}</span
			>
		</button>
	{/each}
</div>

<style>
	/* Responsive column grid + glass rows kept as scoped CSS: the column-hide system keys
	   off marker classes (.c-cat/.c-src/.c-pro/…) across breakpoints — including a narrow
	   1320–1600px band that has no Tailwind equivalent — and .prow is the frosted material. */

	/* Default: every column shows (product, category, source, four macros). */
	.cols {
		grid-template-columns: minmax(0, 1fr) 64px 70px 62px 52px 52px 62px;
	}

	.prow {
		display: grid;
		gap: 14px;
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
		padding: 14px 18px;
	}
	.prow:hover {
		background: color-mix(in oklch, var(--card) 60%, transparent);
	}
	.prow:focus-visible {
		outline: none;
		box-shadow: var(--shadow-soft), var(--focus);
	}
	.prow.on {
		background: var(--card);
		box-shadow:
			var(--shadow-lift),
			inset 0 0 0 1px var(--hairline);
	}

	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.prow {
			background: var(--card);
		}
	}

	/* Category + source hide ONLY in the 1320–1600px band, where the side detail leaves
	   the list too narrow for them; they show at every other width (wider desktops and
	   the <1200px modal layout). Scope to .listhead/.prow so the hide outranks the
	   single-class column display rules and column alignment stays intact. */
	@media (min-width: 1320px) and (max-width: 1600px) {
		.cols {
			grid-template-columns: minmax(0, 1fr) 62px 52px 52px 62px;
		}
		.listhead .c-cat,
		.prow .c-cat,
		.listhead .c-src,
		.prow .c-src {
			display: none;
		}
	}

	/* Tablet / phone — compact: drop category + source, tighten the row padding. */
	@media (max-width: 768px) {
		.cols {
			grid-template-columns: minmax(0, 1fr) 62px 52px 52px 62px;
		}
		.listhead .c-cat,
		.prow .c-cat,
		.listhead .c-src,
		.prow .c-src {
			display: none;
		}
		.prow {
			padding: 12px 14px;
		}
	}

	/* Small phone — just the product and its energy. */
	@media (max-width: 480px) {
		.cols {
			grid-template-columns: minmax(0, 1fr) 58px;
		}
		.listhead .c-pro,
		.prow .c-pro,
		.listhead .c-carb,
		.prow .c-carb,
		.listhead .c-fat,
		.prow .c-fat {
			display: none;
		}
	}
</style>
