<script lang="ts">
	import { ToggleGroup } from "bits-ui";
	import { cn } from "$lib/utils";

	// Pill on an accent track; the active segment lifts on a card fill with a soft
	// shadow. Single-select (per-day vs weekly, etc.) on Bits UI ToggleGroup so
	// keyboard navigation and roving focus come for free.
	type Item = { value: string; label: string };

	type Props = {
		items: Item[];
		/** The selected value (two-way bindable). */
		value?: string;
		/** Fired on user selection — forwarded to the underlying ToggleGroup. */
		onValueChange?: (value: string) => void;
		class?: string;
		"aria-label"?: string;
	};

	let { items, value = $bindable(items[0]?.value ?? ""), class: className, ...restProps }: Props = $props();
</script>

<ToggleGroup.Root
	type="single"
	bind:value
	class={cn("inline-flex gap-0 rounded-pill bg-accent p-[3px]", className)}
	{...restProps}
>
	{#each items as item (item.value)}
		<ToggleGroup.Item
			value={item.value}
			class="cursor-pointer rounded-pill px-3 py-[5px] text-xs font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-[180ms] ease-out-quint focus-visible:outline-none focus-visible:shadow-[var(--focus)] data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-soft"
		>
			{item.label}
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>
