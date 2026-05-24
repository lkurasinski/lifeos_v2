<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	type Props = HTMLAttributes<HTMLDivElement> & { class?: string };

	let { class: className, children, ...restProps }: Props = $props();
</script>

<div class={cn("rounded-lg border bg-card text-card-foreground", className)} {...restProps}>
	{@render children?.()}
</div>
