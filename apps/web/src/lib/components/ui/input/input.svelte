<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	type Props = HTMLInputAttributes & { class?: string; value?: string };

	let { class: className, value = $bindable(""), ...restProps }: Props = $props();
</script>

<input
	class={cn(
		"hud-input flex h-11 w-full rounded-[3px] border border-input bg-background px-3 font-mono text-[0.875rem] caret-primary transition-[border-color,box-shadow] duration-[180ms] ease-out-quint placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
		className,
	)}
	bind:value
	{...restProps}
/>
