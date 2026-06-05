<script lang="ts">
	import { untrack } from "svelte";
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import { Gauge, type Macro } from "$lib/components/ui/gauge";
	import { Panel } from "$lib/components/ui/panel";
	import type { DraftNutrientValue, DraftProduct, NutrientRegistryGroup } from "$lib/food/schema";
	import { t } from "$lib/i18n";
	import CategoryIcon from "./CategoryIcon.svelte";
	import { MACRO_REFERENCE, formatAmount, sourceBadgeKey } from "./meta";

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

	// ─── Editable state, seeded ONCE from the draft. The parent remounts the form via
	// {#key} when the selected draft changes, so a one-time snapshot is intended;
	// `untrack` takes that snapshot without subscribing this seed to later draft churn.
	// Nutrient values are raw input strings keyed by nutrientId — "" = NULL (no data),
	// distinct from "0"; seeded only with present (non-null) amounts.
	const init = untrack(() => {
		const values: Record<string, string> = {};
		for (const n of draft.nutrients) {
			if (n.amountPer100g !== null) values[n.nutrientId] = String(n.amountPer100g);
		}
		return {
			nameEn: draft.nameEn,
			namePl: draft.namePl ?? "",
			brand: draft.brand ?? "",
			categoryId: draft.categoryId ?? "",
			servingSizeG: draft.servingSizeG != null ? String(draft.servingSizeG) : "",
			values,
		};
	});

	let nameEn = $state(init.nameEn);
	let namePl = $state(init.namePl);
	let brand = $state(init.brand);
	let categoryId = $state(init.categoryId);
	let servingSizeG = $state(init.servingSizeG);
	let values = $state<Record<string, string>>(init.values);

	// Group expand/collapse — default every group open (the locked probe shows them expanded).
	let collapsed = $state<Record<string, boolean>>({});
	function toggleGroup(category: string) {
		collapsed[category] = !collapsed[category];
	}

	/** Parse a raw input into a canonical amount: "" → null (NULL≠0); accepts comma decimals. */
	function parseAmount(raw: string | undefined): number | null {
		if (raw === undefined) return null;
		const trimmed = raw.trim();
		if (trimmed === "") return null;
		const n = Number(trimmed.replace(",", "."));
		return Number.isFinite(n) ? n : null;
	}

	// INFOODS macro tag → its registry nutrientId, for the presentational gauges.
	const tagToId = $derived(
		new Map(registry.flatMap((g) => g.nutrients.map((n) => [n.infoodsTagname, n.id]))),
	);

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

	// Four presentational macro rings, driven live by the matching field values.
	const gauges = $derived(
		(
			[
				{ macro: "kcal", label: t("catalog.macros.energy"), tag: "ENERC_KCAL", unit: "kcal", max: MACRO_REFERENCE.kcal },
				{ macro: "pro", label: t("catalog.macros.protein"), tag: "PROCNT", unit: "g", max: MACRO_REFERENCE.protein },
				{ macro: "carb", label: t("catalog.macros.carbs"), tag: "CHOCDF", unit: "g", max: MACRO_REFERENCE.carbs },
				{ macro: "fat", label: t("catalog.macros.fat"), tag: "FAT", unit: "g", max: MACRO_REFERENCE.fat },
			] satisfies { macro: Macro; label: string; tag: string; unit: string; max: number }[]
		).map((g) => {
			const id = tagToId.get(g.tag);
			const value = id ? parseAmount(values[id]) : null;
			const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / g.max) * 100));
			return { ...g, value, pct };
		}),
	);

	// Selected category slug → drives the chip's identity glyph (neutral grid when none).
	const selectedCategorySlug = $derived(categories.find((c) => c.id === categoryId)?.slug ?? null);

	const canSave = $derived((nameEn.trim() !== "" || namePl.trim() !== "") && !saving);

	function submit() {
		// Emit every registry nutrient: present values keep their amount, empties become
		// null. The parent normalizes (draftToSavePayload drops nulls; the edit path
		// removes their rows) — both honor NULL≠0.
		const nutrients: DraftNutrientValue[] = [];
		for (const group of registry) {
			for (const n of group.nutrients) {
				nutrients.push({ nutrientId: n.id, amountPer100g: parseAmount(values[n.id]) });
			}
		}
		const updated: DraftProduct = {
			source: draft.source,
			sourceId: draft.sourceId,
			// nameEn is required by the schema; fall back to the Polish name when only it is filled.
			nameEn: nameEn.trim() || namePl.trim(),
			namePl: namePl.trim() || null,
			brand: brand.trim() || null,
			categoryId: categoryId || null,
			servingSizeG: parseAmount(servingSizeG),
			// Image URLs aren't edited in the form — carry them through from the source draft
			// so saving/editing an OFF product preserves its photos.
			imageUrl: draft.imageUrl ?? null,
			imageThumbUrl: draft.imageThumbUrl ?? null,
			imageIngredientsUrl: draft.imageIngredientsUrl ?? null,
			imageNutritionUrl: draft.imageNutritionUrl ?? null,
			nutrients,
		};
		onSubmit(updated);
	}
</script>

<Panel variant="thick" class="pf">
	<div class="pf-top">
		<div class="pf-eyebrow">
			<div class="et">{eyebrow.title}</div>
			<div class="es">{eyebrow.sub}</div>
		</div>
		{#if mode === "create"}
			<span class="pf-draft"><span class="pulse"></span>{t("add.draftUnsaved")}</span>
		{/if}
	</div>

	<div class="pf-body">
		{#if draft.imageThumbUrl ?? draft.imageUrl}
			<div class="pf-photo">
				<img src={draft.imageThumbUrl ?? draft.imageUrl} alt={t("catalog.photoAlt")} loading="lazy" />
			</div>
		{/if}

		<div class="dchips">
			<Badge>{SOURCE_BADGE[badgeKey]}</Badge>
			{#if draft.source === "OFF" && draft.sourceId}
				<Badge>{t("catalog.sourceId.off")} {draft.sourceId}</Badge>
			{/if}
			<span class="catsel">
				<CategoryIcon slug={selectedCategorySlug} size={13} class="catsel-ic" />
				<select aria-label={t("add.categoryLabel")} bind:value={categoryId}>
					<option value="">{t("add.noCategory")}</option>
					{#each categories as c (c.id)}
						<option value={c.id}>{c.namePl}</option>
					{/each}
				</select>
				<svg class="chev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path d="M10 13.5l-4.5-5h9z" />
				</svg>
			</span>
		</div>

		<div class="names">
			<div class="namefield pl">
				<input type="text" bind:value={namePl} aria-label={t("add.namePlLabel")} placeholder={t("add.namePlLabel")} />
				<span class="nameflag">PL</span>
			</div>
			<div class="namefield en">
				<input type="text" bind:value={nameEn} aria-label={t("add.nameEnLabel")} placeholder={t("add.nameEnLabel")} />
				<span class="nameflag">EN</span>
			</div>
		</div>

		<div class="basis">{t("add.profileBasis")}</div>
		<div class="gauges">
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

		<div class="meta">
			<label class="srv brand">
				<span class="srvl">{t("add.brandLabel")}</span>
				<input
					class="brandin"
					type="text"
					bind:value={brand}
					placeholder={t("add.brandPlaceholder")}
					aria-label={t("add.brandLabel")}
				/>
			</label>
			<label class="srv">
				<span class="srvl">{t("add.servingSize")}</span>
				<span class="srvin">
					<input type="number" inputmode="decimal" min="0" bind:value={servingSizeG} aria-label={t("add.servingSize")} />
					<span class="srvu">g</span>
				</span>
			</label>
		</div>

		<div class="divider"></div>

		<div class="legend">
			<span class="lt">{t("add.fullProfile")}</span>
			<span class="lh">
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
			{@const open = !collapsed[group.category]}
			{@const filled = group.nutrients.filter((n) => parseAmount(values[n.id]) !== null).length}
			<div class="ng">
				<button type="button" class="ngh" class:open onclick={() => toggleGroup(group.category)}>
					<span class="gt">{GROUP_LABEL[group.category] ?? group.category}</span>
					<span class="gx">{filled}/{group.nutrients.length}</span>
					<svg class="chev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path d="M10 13.5l-4.5-5h9z" />
					</svg>
				</button>
				{#if open}
					{#each group.nutrients as n (n.id)}
						{@const empty = parseAmount(values[n.id]) === null}
						<div class="nr" class:na={empty}>
							<span class="k">{n.namePl || n.nameEn}</span>
							<span class="vfield">
								<input
									type="number"
									inputmode="decimal"
									min="0"
									step="any"
									bind:value={values[n.id]}
									placeholder={t("add.noDataPlaceholder")}
									aria-label={n.namePl || n.nameEn}
								/>
								<span class="vu">{n.unit}</span>
							</span>
						</div>
					{/each}
				{/if}
			</div>
		{/each}
	</div>

	<div class="pf-bar">
		<button type="button" class="ghost" onclick={() => onCancel?.()}>
			{cancelLabel ?? t("common.cancel")}
		</button>
		<span class="barnote" class:err={!!errorMessage}>{errorMessage ?? ""}</span>
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
	:global(.pf) {
		padding: 0;
		border-radius: var(--radius);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
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

	.pf-top {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 18px 22px 0;
	}
	.pf-eyebrow {
		flex: 1;
		min-width: 0;
	}
	.pf-eyebrow .et {
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
	.pf-eyebrow .es {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		line-height: 1.4;
		margin-top: 3px;
	}
	/* Neutral "unsaved" pill — never a semantic hue (colour is reserved for scored data). */
	.pf-draft {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--foreground);
		background: var(--card);
		box-shadow: var(--shadow-soft);
		padding: 6px 11px 6px 9px;
		border-radius: var(--pill);
		flex-shrink: 0;
		white-space: nowrap;
	}
	.pf-draft .pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--muted-foreground);
		position: relative;
	}
	.pf-draft .pulse::after {
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
		.pf-draft .pulse::after {
			animation: none;
		}
	}

	.pf-body {
		padding: 14px 22px 4px;
	}
	/* OFF preview photo — contained on a neutral tile (read-only; not an editable field).
	   Fixed height reserves space (tile = placeholder) so the form doesn't jump on load. */
	.pf-photo {
		display: grid;
		place-items: center;
		height: 200px;
		background: var(--secondary);
		border-radius: var(--radius);
		padding: 12px;
		margin-bottom: 14px;
	}
	.pf-photo img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		border-radius: var(--radius-sm);
	}
	.dchips {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 13px;
	}
	/* Editable category select styled as a chip with a leading glyph + chevron. */
	.catsel {
		position: relative;
		display: inline-flex;
		align-items: center;
	}
	.catsel :global(.catsel-ic) {
		position: absolute;
		left: 9px;
		pointer-events: none;
	}
	.catsel select {
		appearance: none;
		-webkit-appearance: none;
		font-family: inherit;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--foreground);
		background: var(--card);
		box-shadow: var(--shadow-soft);
		border: 0;
		border-radius: var(--pill);
		padding: 5px 26px 5px 26px;
		cursor: pointer;
		outline: none;
	}
	.catsel:focus-within select {
		box-shadow: var(--shadow-soft), var(--focus);
	}
	.catsel .chev {
		position: absolute;
		right: 8px;
		width: 13px;
		height: 13px;
		color: var(--muted-foreground);
		pointer-events: none;
	}

	.names {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.namefield {
		position: relative;
	}
	.namefield input {
		width: 100%;
		font-family: inherit;
		border: 1px solid transparent;
		background: transparent;
		border-radius: var(--radius-sm);
		outline: none;
		color: var(--foreground);
		padding: 5px 32px 5px 9px;
	}
	.namefield.pl input {
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.namefield.en input {
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}
	.namefield input:hover {
		border-color: var(--border);
	}
	.namefield input:focus {
		border-color: transparent;
		background: var(--card);
		box-shadow: var(--focus);
	}
	.nameflag {
		position: absolute;
		right: 9px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--muted-foreground);
		pointer-events: none;
	}

	.basis {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin: 18px 0 11px;
	}
	.gauges {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}

	.meta {
		margin-top: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.srv {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.brandin {
		flex: 1;
		min-width: 0;
		max-width: 260px;
		text-align: right;
		font-family: inherit;
		font-size: 0.8125rem;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 7px 9px;
		outline: none;
	}
	.brandin::placeholder {
		color: var(--muted-foreground);
	}
	.brandin:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.srvl {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
	}
	.srvin {
		position: relative;
		display: flex;
		align-items: center;
	}
	.srvin input {
		width: 96px;
		text-align: right;
		font-family: inherit;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 7px 26px 7px 9px;
		outline: none;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.srvin input::-webkit-outer-spin-button,
	.srvin input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.srvin input:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.srvu {
		position: absolute;
		right: 9px;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		pointer-events: none;
	}

	.divider {
		height: 1px;
		background: var(--hairline);
		margin: 18px 0;
	}
	.legend {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		margin: 0 0 4px;
	}
	.legend .lt {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.legend .lh {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-align: right;
	}
	.legend .lh svg {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		opacity: 0.6;
	}

	.ng {
		margin-top: 6px;
	}
	.ngh {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		border: 0;
		background: transparent;
		cursor: pointer;
		font-family: inherit;
		padding: 9px 2px;
		border-bottom: 1px solid var(--hairline);
	}
	.ngh:focus-visible {
		outline: none;
		box-shadow: var(--focus);
		border-radius: var(--radius-sm);
	}
	.ngh .gt {
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--foreground);
	}
	.ngh .gx {
		margin-left: auto;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground);
	}
	.ngh .chev {
		width: 15px;
		height: 15px;
		color: var(--muted-foreground);
		transition: transform 0.2s var(--ease);
	}
	.ngh.open .chev {
		transform: rotate(180deg);
	}
	@media (prefers-reduced-motion: reduce) {
		.ngh .chev {
			transition: none;
		}
	}

	.nr {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 2px 6px 16px;
	}
	.nr .k {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
	}
	.vfield {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.vfield input {
		width: 84px;
		text-align: right;
		font-family: inherit;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 5px 9px;
		outline: none;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.vfield input::-webkit-outer-spin-button,
	.vfield input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.vfield input:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.vfield input::placeholder {
		color: var(--muted-foreground);
		font-style: italic;
		font-variant-numeric: normal;
	}
	.vfield .vu {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		width: 24px;
		text-align: left;
	}
	/* "No data" (empty) state: dashed input border + dimmed unit — NULL, not 0. */
	.nr.na .vfield input {
		border-style: dashed;
	}
	.nr.na .vu {
		opacity: 0.4;
	}

	/* Sticky action bar — the weightier action (Save) sits on the right. */
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
	.pf-bar .ghost {
		border: 0;
		background: transparent;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 10px;
		border-radius: var(--radius-sm);
	}
	.pf-bar .ghost:hover {
		background: var(--accent);
		color: var(--foreground);
	}
	.barnote {
		flex: 1;
		text-align: center;
		font-size: 0.6875rem;
		line-height: 1.4;
		color: var(--muted-foreground);
	}
	.barnote.err {
		color: var(--destructive);
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
		.pf-top,
		.pf-body,
		.pf-bar {
			padding-left: 16px;
			padding-right: 16px;
		}
		.namefield.pl input {
			font-size: 1.375rem;
		}
	}
</style>
