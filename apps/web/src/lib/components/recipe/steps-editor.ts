/**
 * Pure projection helpers for the steps EDITOR (`StepsEditor.svelte`) — the keyed editable
 * `StepItem` ↔ persisted `RecipeStep` mapping. No runes, no I/O: the component owns the keyed
 * `$state` list and the crypto key minting; this module is the unit-testable kernel both
 * directions go through, so the projection stays a pure `$derived` instead of an `$effect`
 * write-back. (Distinct from `steps.ts`, which builds the DETAIL view's render stages.)
 */
import type { RecipeStep } from "$lib/recipe/schema";

/**
 * One editable step row. Keyed for a stable `{#each}` (RecipeStep carries no id) and richer than
 * the persisted union: it always holds a `durationMin` (a buffer even for `action` rows) and an
 * `imageUrl` slot, so editing a field or toggling the image affordance never drops a half-entered
 * value. `itemToStep` narrows it back to the tagged union on read.
 */
export type StepItem = {
	key: string;
	kind: "action" | "wait";
	text: string;
	/** Action image URL; `null` = no image (the field is hidden). Unused for `wait` rows. */
	imageUrl: string | null;
	durationMin: number;
};

/** A fresh blank row of `kind`. `key` is minted by the caller (crypto stays in the component). */
export function newStepItem(kind: "action" | "wait", key: string): StepItem {
	return { key, kind, text: "", imageUrl: null, durationMin: 10 };
}

/**
 * Seed an editable item from a stored step. Action rows get a sensible `durationMin` buffer (so a
 * later kind change wouldn't read 0); wait rows hide the image field. `key` is caller-supplied.
 */
export function stepToItem(step: RecipeStep, key: string): StepItem {
	return {
		key,
		kind: step.kind,
		text: step.text,
		imageUrl: step.kind === "action" ? (step.imageUrl ?? null) : null,
		durationMin: step.kind === "wait" ? step.durationMin : 10,
	};
}

/**
 * Project an editable item back to the persisted tagged-union step. This is the RAW projection —
 * the save payload (`recipeDraftToSavePayload`) re-normalizes it (drops blank-text rows, trims,
 * coerces a cleared `durationMin`), so no cleanup happens here.
 */
export function itemToStep(item: StepItem): RecipeStep {
	return item.kind === "wait"
		? { kind: "wait", text: item.text, durationMin: item.durationMin }
		: { kind: "action", text: item.text, imageUrl: item.imageUrl };
}
