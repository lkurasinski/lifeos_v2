<script lang="ts">
	import type { FoodDocument, SortKey } from "$lib/food/schema";
	import { t } from "$lib/i18n";
	import { Badge } from "$lib/components/ui/badge";
	import CategoryIcon from "./CategoryIcon.svelte";
	import { formatAmount, sourceBadgeKey } from "./meta";

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

	/** Display a macro value, or an em dash when it's absent (NULL, never 0). */
	function macro(value: number | undefined): string {
		return value === undefined ? "—" : formatAmount(value);
	}
</script>

<div class="listhead cols">
	<button type="button" class="colh" class:on={sort === "name"} onclick={() => onSort("name")}>
		{t("catalog.columns.product")}
		<svg class="ar" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path d={sort === "name" && dir === "asc" ? "M10 6l3.5 4h-7z" : "M10 14l-3.5-4h7z"} />
		</svg>
	</button>
	<span class="colh nosort c-cat">{t("catalog.columns.category")}</span>
	<span class="colh nosort c-src">{t("catalog.columns.source")}</span>
	{#each numericCols as col (col.key)}
		<button
			type="button"
			class="colh num {col.cls}"
			class:on={sort === col.key}
			onclick={() => onSort(col.key)}
		>
			{col.label}
			<svg class="ar" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path d={sort === col.key && dir === "asc" ? "M10 6l3.5 4h-7z" : "M10 14l-3.5-4h7z"} />
			</svg>
		</button>
	{/each}
</div>

<div class="list">
	{#each hits as hit (hit.id)}
		{@const badge = sourceBadgeKey(hit.source)}
		<button
			type="button"
			class="prow cols"
			class:on={selectedId === hit.id}
			onclick={() => onSelect(hit.id)}
		>
			<div class="pname">
				<div class="nm">{hit.namePl ?? hit.nameEn}</div>
			</div>
			<span class="pcat c-cat" title={hit.categoryNamePl ?? ""}>
				<CategoryIcon slug={hit.categorySlug} size={18} />
			</span>
			<span class="psrc c-src"><Badge>{SOURCE_BADGE[badge]}</Badge></span>
			<span class="num kcal">{macro(hit.energyKcal)}</span>
			<span class="num mac c-pro">{macro(hit.protein)}</span>
			<span class="num mac c-carb">{macro(hit.carbs)}</span>
			<span class="num mac c-fat">{macro(hit.fat)}</span>
		</button>
	{/each}
</div>

<style>
	/* Default: every column shows (product, category, source, four macros). Columns are
	   only dropped in the narrow bands defined below. */
	.cols {
		grid-template-columns: minmax(0, 1fr) 64px 70px 62px 52px 52px 62px;
	}
	.listhead {
		display: grid;
		gap: 14px;
		padding: 2px 18px 11px;
		align-items: end;
	}
	.colh {
		border: 0;
		background: transparent;
		font-family: inherit;
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 0;
	}
	.colh:hover {
		color: var(--foreground);
	}
	.colh.num {
		justify-content: flex-end;
	}
	.colh.on {
		color: var(--foreground);
		font-weight: 600;
	}
	.colh.nosort {
		cursor: default;
	}
	.colh:focus-visible {
		outline: none;
		color: var(--foreground);
	}
	.colh .ar {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
	}
	.colh:not(.on) .ar {
		opacity: 0;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
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
		box-shadow: var(--shadow-lift), inset 0 0 0 1px var(--hairline);
	}
	.pname {
		min-width: 0;
	}
	.pname .nm {
		font-size: 0.9375rem;
		font-weight: 550;
		letter-spacing: -0.01em;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--foreground);
	}
	.pcat {
		display: flex;
		align-items: center;
	}
	/* Grid-cell wrapper around the kit Badge: owns the cell's left-alignment and
	   carries .c-src so the responsive column-hide rules (scoped to .prow) still match. */
	.psrc {
		display: inline-flex;
		align-items: center;
		justify-self: start;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
	}
	.kcal {
		font-weight: 300;
		letter-spacing: -0.02em;
		font-size: 1.3125rem;
		line-height: 1;
	}
	.mac {
		font-size: 0.9375rem;
	}

	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.prow {
			background: var(--card);
		}
	}

	/* Category + source hide ONLY in the 1320–1600px band, where the side detail leaves
	   the list too narrow for them; they show at every other width (wider desktops and
	   the <1200px modal layout). Scope to .listhead/.prow so the hide outranks the
	   single-class .colh/.pcat/.badge display rules and column alignment stays intact. */
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

	/* Tablet / phone — compact: drop category + source, tighten padding. */
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
		.listhead {
			padding: 2px 14px 10px;
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
