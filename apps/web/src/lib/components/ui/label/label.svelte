<script lang="ts">
	import type { HTMLLabelAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	type Props = HTMLLabelAttributes & { class?: string };

	let { class: className, children, ...restProps }: Props = $props();
</script>

<label
	class={cn(
		"text-[0.6875rem] font-medium uppercase leading-none tracking-[0.06em] text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</label>
