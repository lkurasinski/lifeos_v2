<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLSelectAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	// A native <select> styled as a card field with a chevron overlay (appearance
	// stripped). Defaults to the regular 15px field; pass `selectClass` to retune
	// padding/scale for compact rows. `class` styles the wrapper, `selectClass` the
	// <select>; <option>s are the default slot.
	type Props = Omit<HTMLSelectAttributes, "class"> & {
		class?: string;
		selectClass?: string;
		value?: string;
		children: Snippet;
	};

	let {
		class: className,
		selectClass,
		value = $bindable(""),
		children,
		...restProps
	}: Props = $props();
</script>

<span class={cn("relative block", className)}>
	<select
		class={cn(
			"w-full cursor-pointer appearance-none rounded-sm border border-input bg-card py-[10px] pl-3 pr-9 text-[0.9375rem] text-foreground outline-none transition-[border-color,box-shadow] duration-[180ms] ease-out-quint focus-visible:border-transparent focus-visible:shadow-[var(--focus)]",
			selectClass,
		)}
		bind:value
		{...restProps}
	>
		{@render children()}
	</select>
	<svg
		class="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M10 13.5l-4.5-5h9z" />
	</svg>
</span>
