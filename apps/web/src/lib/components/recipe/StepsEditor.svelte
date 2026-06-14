<script lang="ts">
	import { untrack } from "svelte";
	import type { RecipeStep } from "$lib/recipe/schema";
	import { Button } from "$lib/components/ui/button";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { TintedBadge } from "$lib/components/ui/tinted-badge";
	import { t } from "$lib/i18n";

	// The steps editor (locked by `form.html`): an ordered list of `action` steps (numbered,
	// text + optional image-URL field — inert pending the upload slice) and `wait` steps
	// (hourglass, text + a `durationMin` control). `Dodaj krok` / `Dodaj oczekiwanie` append the
	// matching kind; the grip reorders. Stages / the start-ahead banner are DERIVED at render time
	// (the detail view), never authored here — this only edits the flat tagged-union list.
	//
	// Internally a keyed `items` mirror drives a stable `{#each}` (RecipeStep carries no id), and
	// an effect projects it back into the bound `steps` payload array.
	type Props = { steps: RecipeStep[] };
	let { steps = $bindable() }: Props = $props();

	type Item = {
		key: string;
		kind: "action" | "wait";
		text: string;
		/** Action image URL; `null` = no image (the field is hidden). */
		imageUrl: string | null;
		durationMin: number;
	};

	function newKey(): string {
		return crypto.randomUUID();
	}

	let items = $state<Item[]>(
		untrack(() =>
			steps.map((s) => ({
				key: newKey(),
				kind: s.kind,
				text: s.text,
				imageUrl: s.kind === "action" ? (s.imageUrl ?? null) : null,
				durationMin: s.kind === "wait" ? s.durationMin : 10,
			})),
		),
	);

	function toStep(i: Item): RecipeStep {
		return i.kind === "wait"
			? { kind: "wait", text: i.text, durationMin: i.durationMin }
			: { kind: "action", text: i.text, imageUrl: i.imageUrl };
	}

	// Project the keyed mirror back into the bound payload array whenever it changes.
	$effect(() => {
		steps = items.map(toStep);
	});

	// Sequential numbers for action steps only (wait steps render an hourglass, not a number).
	const numbers = $derived.by<Record<string, number>>(() => {
		const map: Record<string, number> = {};
		let n = 0;
		for (const i of items) if (i.kind === "action") map[i.key] = ++n;
		return map;
	});

	function addAction() {
		items.push({ key: newKey(), kind: "action", text: "", imageUrl: null, durationMin: 10 });
	}
	function addWait() {
		items.push({ key: newKey(), kind: "wait", text: "", imageUrl: null, durationMin: 10 });
	}
	function remove(key: string) {
		const i = items.findIndex((it) => it.key === key);
		if (i !== -1) items.splice(i, 1);
	}

	// Drag reorder — grip is the draggable handle, rows are drop targets.
	let dragKey = $state<string | null>(null);
	function onDragStart(e: DragEvent, key: string) {
		dragKey = key;
		e.dataTransfer?.setData("text/plain", key);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
	}
	function onDrop(targetKey: string) {
		const from = dragKey;
		dragKey = null;
		if (from === null || from === targetKey) return;
		const fromIdx = items.findIndex((c) => c.key === from);
		const toIdx = items.findIndex((c) => c.key === targetKey);
		if (fromIdx === -1 || toIdx === -1) return;
		const [moved] = items.splice(fromIdx, 1);
		items.splice(toIdx, 0, moved);
	}
</script>

{#snippet grip(key: string)}
	<span
		class="grip"
		role="button"
		tabindex="0"
		draggable="true"
		aria-label={t("recipe.form.removeStep")}
		ondragstart={(e) => onDragStart(e, key)}
		ondragend={() => (dragKey = null)}
	>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<circle cx="7.5" cy="5" r="1.3" /><circle cx="12.5" cy="5" r="1.3" /><circle cx="7.5" cy="10" r="1.3" /><circle cx="12.5" cy="10" r="1.3" /><circle cx="7.5" cy="15" r="1.3" /><circle cx="12.5" cy="15" r="1.3" />
		</svg>
	</span>
{/snippet}

<div class="stepslist">
	{#each items as item (item.key)}
		{#if item.kind === "wait"}
			<div class="waite" class:dragging={dragKey === item.key} role="listitem" ondragover={(e) => e.preventDefault()} ondrop={(e) => { e.preventDefault(); onDrop(item.key); }}>
				{@render grip(item.key)}
				<TintedBadge tone="amber">
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.5 2.5h9a1 1 0 0 1 0 2H14c0 2.5-1.3 3.8-3.2 5.5C12.7 11.7 14 13 14 15.5h.5a1 1 0 0 1 0 2h-9a1 1 0 0 1 0-2H6c0-2.5 1.3-3.8 3.2-5.5C7.3 8.3 6 7 6 4.5h-.5a1 1 0 0 1 0-2Z" /></svg>
				</TintedBadge>
				<div class="wbody">
					<input class="wt" type="text" bind:value={item.text} placeholder={t("recipe.form.waitPlaceholder")} aria-label={t("recipe.form.waitPlaceholder")} />
					<span class="wdur">
						<input type="number" inputmode="numeric" min="1" step="1" bind:value={item.durationMin} aria-label={t("recipe.form.waitDurationLabel")} />
						<span class="wuu">{t("recipe.form.minUnit")}</span>
					</span>
				</div>
				<IconButton type="button" variant="ghost" size="sm" class="size-[30px]" aria-label={t("recipe.form.removeStep")} onclick={() => remove(item.key)}>
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.7 5.7a1 1 0 0 1 1.4 0L10 8.6l2.9-2.9a1 1 0 1 1 1.4 1.4L11.4 10l2.9 2.9a1 1 0 0 1-1.4 1.4L10 11.4l-2.9 2.9a1 1 0 0 1-1.4-1.4L8.6 10 5.7 7.1a1 1 0 0 1 0-1.4Z" /></svg>
				</IconButton>
			</div>
		{:else}
			<div class="stepe" class:dragging={dragKey === item.key} role="listitem" ondragover={(e) => e.preventDefault()} ondrop={(e) => { e.preventDefault(); onDrop(item.key); }}>
				{@render grip(item.key)}
				<span class="snum">{numbers[item.key]}</span>
				<div class="sbody">
					<textarea bind:value={item.text} placeholder={t("recipe.form.stepPlaceholder")} aria-label={`${t("recipe.form.stepsTitle")} ${numbers[item.key]}`}></textarea>
					<div class="simg">
						{#if item.imageUrl !== null}
							<span class="simg-row">
								<input type="url" bind:value={item.imageUrl} placeholder={t("recipe.form.stepImagePlaceholder")} aria-label={t("recipe.form.addStepImage")} />
								<IconButton type="button" variant="ghost" size="sm" class="size-[30px]" aria-label={t("recipe.form.removeRow")} onclick={() => (item.imageUrl = null)}>
									<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.7 5.7a1 1 0 0 1 1.4 0L10 8.6l2.9-2.9a1 1 0 1 1 1.4 1.4L11.4 10l2.9 2.9a1 1 0 0 1-1.4 1.4L10 11.4l-2.9 2.9a1 1 0 0 1-1.4-1.4L8.6 10 5.7 7.1a1 1 0 0 1 0-1.4Z" /></svg>
								</IconButton>
							</span>
						{:else}
							<Button type="button" variant="ghost" size="sm" onclick={() => (item.imageUrl = "")}>
								<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 3.5A1.5 1.5 0 0 0 2.5 5v10A1.5 1.5 0 0 0 4 16.5h12A1.5 1.5 0 0 0 17.5 15V5A1.5 1.5 0 0 0 16 3.5H4Zm0 11 3.5-4 2.2 2.6L12.5 9l3.5 4.5H4Z" clip-rule="evenodd" /><circle cx="7" cy="7.5" r="1.4" /></svg>
								{t("recipe.form.addStepImage")}
							</Button>
						{/if}
					</div>
				</div>
				<IconButton type="button" variant="ghost" size="sm" class="mt-1 size-[30px]" aria-label={t("recipe.form.removeStep")} onclick={() => remove(item.key)}>
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.7 5.7a1 1 0 0 1 1.4 0L10 8.6l2.9-2.9a1 1 0 1 1 1.4 1.4L11.4 10l2.9 2.9a1 1 0 0 1-1.4 1.4L10 11.4l-2.9 2.9a1 1 0 0 1-1.4-1.4L8.6 10 5.7 7.1a1 1 0 0 1 0-1.4Z" /></svg>
				</IconButton>
			</div>
		{/if}
	{/each}
</div>

<div class="addbtns">
	<Button type="button" variant="secondary" size="sm" onclick={addAction}>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z" /></svg>
		{t("recipe.form.addStep")}
	</Button>
	<Button type="button" variant="secondary" size="sm" onclick={addWait}>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.5 2.5h9a1 1 0 0 1 0 2H14c0 2.5-1.3 3.8-3.2 5.5C12.7 11.7 14 13 14 15.5h.5a1 1 0 0 1 0 2h-9a1 1 0 0 1 0-2H6c0-2.5 1.3-3.8 3.2-5.5C7.3 8.3 6 7 6 4.5h-.5a1 1 0 0 1 0-2Z" /></svg>
		{t("recipe.form.addWait")}
	</Button>
</div>

<style>
	.stepslist {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.stepe {
		display: grid;
		grid-template-columns: 18px 26px minmax(0, 1fr) 30px;
		gap: 10px;
		align-items: start;
	}
	.stepe.dragging,
	.waite.dragging {
		opacity: 0.45;
	}
	.grip {
		color: var(--muted-foreground);
		opacity: 0.5;
		cursor: grab;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 11px;
	}
	.grip:active {
		cursor: grabbing;
	}
	.grip svg {
		width: 15px;
		height: 15px;
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
		margin-top: 4px;
		box-shadow: inset 0 0 0 1px var(--hairline);
	}
	.sbody {
		min-width: 0;
	}
	.sbody textarea {
		width: 100%;
		font-family: inherit;
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		outline: none;
		resize: vertical;
		min-height: 54px;
	}
	.sbody textarea:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.sbody textarea::placeholder {
		color: var(--muted-foreground);
	}
	.simg {
		margin-top: 7px;
	}
	.simg-row {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.simg-row input {
		flex: 1;
		min-width: 0;
		font-family: inherit;
		font-size: 0.8125rem;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 7px 10px;
		outline: none;
	}
	.simg-row input:focus {
		border-color: transparent;
		box-shadow: var(--focus);
	}
	.waite {
		display: grid;
		grid-template-columns: 18px 26px minmax(0, 1fr) 30px;
		gap: 10px;
		align-items: center;
	}
	.wbody {
		display: flex;
		align-items: center;
		gap: 10px;
		background: oklch(0.78 0.13 78 / 0.14);
		border-radius: var(--radius-sm);
		padding: 9px 12px;
	}
	.wbody input.wt {
		flex: 1;
		min-width: 0;
		font-family: inherit;
		font-size: 0.9375rem;
		color: oklch(0.4 0.075 72);
		background: transparent;
		border: 0;
		outline: none;
	}
	.wbody input.wt::placeholder {
		color: oklch(0.55 0.05 74);
	}
	.wdur {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--card);
		border-radius: var(--radius-sm);
		padding: 5px 9px;
		box-shadow: var(--shadow-soft);
	}
	.wdur input {
		width: 38px;
		text-align: right;
		font-family: inherit;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
		background: transparent;
		border: 0;
		outline: none;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.wdur input::-webkit-outer-spin-button,
	.wdur input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.wdur .wuu {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
	}

	.addbtns {
		display: flex;
		gap: 8px;
		margin-top: 13px;
		flex-wrap: wrap;
	}
</style>
