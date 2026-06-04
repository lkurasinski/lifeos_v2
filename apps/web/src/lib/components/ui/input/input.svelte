<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	type Props = HTMLInputAttributes & { class?: string; value?: string };

	let { class: className, value = $bindable(""), ...restProps }: Props = $props();
</script>

<input
	class={cn(
		"flex h-11 w-full rounded-sm border border-input bg-card px-3.5 text-[0.9375rem] text-foreground caret-primary transition-[border-color,box-shadow] duration-[180ms] ease-out-quint placeholder:text-muted-foreground/70 focus-visible:border-transparent focus-visible:outline-none focus-visible:shadow-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
		className,
	)}
	bind:value
	{...restProps}
/>
