<script lang="ts">
	import { ToggleGroup } from "bits-ui";
	import { cn } from "$lib/utils";

	// Pill on an accent track; the active segment lifts on a card fill with a soft
	// shadow. Single-select (per-day vs weekly, etc.) on Bits UI ToggleGroup so
	// keyboard navigation and roving focus come for free. A single-select control must
	// always keep a value, so the deselect-to-empty that ToggleGroup allows is suppressed
	// here — which also makes it safe to drive one-way (`value` + `onValueChange`), not
	// just via `bind:value`. `block` stretches the track full-width with equal segments
	// (e.g. a picker tab bar).
	type Item = { value: string; label: string };

	type Props = {
		items: Item[];
		/** The selected value (two-way bindable, or one-way with `onValueChange`). */
		value?: string;
		/** Fired on user selection (never with an empty value). */
		onValueChange?: (value: string) => void;
		/** Full-width track with equal-width segments. */
		block?: boolean;
		class?: string;
		"aria-label"?: string;
	};

	let {
		items,
		value = $bindable(items[0]?.value ?? ""),
		onValueChange,
		block = false,
		class: className,
		...restProps
	}: Props = $props();
</script>

<ToggleGroup.Root
	type="single"
	{value}
	onValueChange={(v) => {
		if (!v) return;
		value = v;
		onValueChange?.(v);
	}}
	class={cn("inline-flex gap-0 rounded-pill bg-accent p-[3px]", block && "flex w-full", className)}
	{...restProps}
>
	{#each items as item (item.value)}
		<ToggleGroup.Item
			value={item.value}
			class={cn(
				"cursor-pointer rounded-pill px-3 py-[5px] text-xs font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-[180ms] ease-out-quint focus-visible:outline-none focus-visible:shadow-[var(--focus)] data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-soft",
				block && "flex-1",
			)}
		>
			{item.label}
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>
