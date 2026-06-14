<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	// A numeric text field: card surface, right-aligned tabular figures, native
	// spinners suppressed, and an optional unit suffix rendered inside the field.
	// Defaults to the compact 13px right-aligned look; width and any scale/align
	// retuning come from the call site — `class` styles the wrapper (width, margin),
	// `inputClass` styles the <input> itself.
	type Props = Omit<HTMLInputAttributes, "value" | "class"> & {
		class?: string;
		inputClass?: string;
		/** Unit label shown inside the field, right-aligned (e.g. "g", "min"). */
		unit?: string;
		value?: string | number | null;
	};

	let {
		class: className,
		inputClass,
		unit,
		type = "number",
		value = $bindable(null),
		...restProps
	}: Props = $props();
</script>

<span class={cn("relative flex items-center", className)}>
	<input
		{type}
		class={cn(
			"w-full rounded-sm border border-input bg-card px-[9px] py-[7px] text-right text-[0.8125rem] text-foreground caret-primary tabular-nums outline-none transition-[border-color,box-shadow] duration-[180ms] ease-out-quint placeholder:text-muted-foreground focus-visible:border-transparent focus-visible:shadow-[var(--focus)] [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none",
			unit && "pr-[26px]",
			inputClass,
		)}
		bind:value
		{...restProps}
	/>
	{#if unit}
		<span class="pointer-events-none absolute right-[9px] text-[0.6875rem] text-muted-foreground"
			>{unit}</span
		>
	{/if}
</span>
