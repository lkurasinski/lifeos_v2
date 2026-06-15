<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils";

	// An inline metadata atom: an optional leading icon, a bold value (the default
	// slot), and an optional muted uppercase label suffix. Sized for detail headers
	// and card meta rows (time · difficulty · servings, etc.). Lay several out in a
	// flex/gap container.
	type Props = {
		icon?: Snippet;
		label?: string;
		class?: string;
		children: Snippet;
	};

	let { icon, label, class: className, children }: Props = $props();
</script>

<span class={cn("inline-flex items-center gap-[7px] text-[0.8125rem] text-foreground", className)}>
	{#if icon}
		<span class="inline-flex shrink-0 text-muted-foreground [&_svg]:size-4">{@render icon()}</span>
	{/if}
	<b class="font-[550]">{@render children()}</b>
	{#if label}
		<span class="ml-px text-[0.6875rem] uppercase tracking-[0.04em] text-muted-foreground">{label}</span>
	{/if}
</span>
