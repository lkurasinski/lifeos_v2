# UI Component Review — 2026-06-15

Scope: the recently developed UI components and their adopters —
`PickerPopover`, `TintedBadge`, `ExpandableRow`, `Field`, `AuthHeader`,
`AuthFooterLink` (commits `7b9fec2`…`1ed6805`).

Overall: well-crafted, single-purpose primitives with strong design-token
discipline and excellent header comments encoding host contracts. Findings are
accessibility gaps and reuse/consistency cleanups — no correctness bugs.

## Accessibility

1. **`PickerPopover` tabs lack ARIA roles** — `ui/picker-popover/picker-popover.svelte:29-43`
   Bare `<button>`s with no `role="tablist"`/`role="tab"`, no `aria-selected`,
   no roving tabindex / arrow-key navigation. Status: **FIXED** (added tablist
   semantics, `aria-selected`, roving tabindex, ArrowLeft/Right navigation).

2. **`Field` error not announced** — `ui/field/field.svelte:53-58`
   Error `<p>` not linked to the control and not announced. Field doesn't own
   the slotted input, so it can't set `aria-describedby`/`aria-invalid`. Status:
   **FIXED** — error rendered as a `role="alert"` live region (announced on
   appearance). Full `aria-describedby` wiring deferred: parameterizing the
   `children` snippet to expose an id would be a breaking change no caller needs.

3. **`Field` `horizontal` silently drops `error`/`hint`/`labelAction`** —
   `ui/field/field.svelte:37-41`. Status: **FIXED** — horizontal now renders
   error/hint beneath the row (backward compatible when absent).

4. **`ExpandableRow` body not associated with trigger** —
   `ui/expandable-row/expandable-row.svelte:22-47`. No `aria-controls`. Status:
   **FIXED** — body wrapped with a generated id; button gets `aria-controls`.

## Reuse / consistency

5. **RecipeDetail full-profile expander hand-rolls a disclosure** —
   `recipe/RecipeDetail.svelte:381-411`. Matches `CollapsibleSection`
   (chevron-after, 180°), not `ExpandableRow`. Status: **FIXED** — adopted
   `CollapsibleSection` (`buttonClass="p-0.5"`, `chevronClass="ml-auto size-[17px]"`);
   removed ~40 lines of duplicated button/chevron markup + scoped styles. Header
   text classes (`.et`/`.ec`) preserved.

6. **New primitives don't forward rest props** (cf. `Badge` spreads
   `{...restProps}`). Status: **FIXED for `ExpandableRow` + `PickerPopover`**
   (enables `id`/`data-*`/`aria-*`). Deferred for `Field` (dual-root
   `<label>`/`<div>` makes a single rest target awkward).

7. **`PickerPopover` reinvents the segmented control** instead of reusing
   `SegmentedToggle`. Status: **FIXED** — `PickerPopover` now renders
   `<SegmentedToggle block …>`, dropping the bespoke tab markup and the manual
   roving-focus code added in #1 (bits-ui `ToggleGroup` provides keyboard nav +
   semantics). Enablers: (a) hardened `SegmentedToggle` to suppress
   ToggleGroup's deselect-to-empty — a single-select must keep a value, which
   also makes it safe to drive one-way (`value` + `onValueChange`); (b) added a
   `block` prop for the full-width, equal-segment layout the picker needs.
   `PickerPopover`'s external API (`tabs`/`activeTab`/`onTabChange`) is
   unchanged, so `ProductPicker` needs no edits.

## Minor / notes

8. **`TintedBadge` hardcodes raw oklch literals** —
   `ui/tinted-badge/tinted-badge.svelte:13-15`. A third color-identity
   exception beyond the two recorded (macro gauges, category icons). Status:
   **DEFERRED** — design-system decision (promote to tokens or sanction the
   exception). `info` tone is currently unused.

9. **`debounced.svelte.ts` is not a drop-in for `ProductPicker`** — the util
   debounces a value into `.current` for `$derived`; the picker debounces an
   async fetch with a token guard. Different shapes; keep separate. No change.

10. **Sibling class-merge idioms differ** — `AuthHeader` ternary vs
    `AuthFooterLink` array. Status: **FIXED** — aligned to the array form.

11. **`ProductPicker` stale fetches complete (not aborted)** —
    `recipe/ProductPicker.svelte:87-108`. Token guard already prevents bad
    state; `AbortController` is marginal. No change.
</content>
</invoke>
