<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	type Props = HTMLAttributes<HTMLParagraphElement> & { class?: string };

	let { class: className, children, ...restProps }: Props = $props();
</script>

<p class={cn("text-[0.9375rem] leading-[1.6] text-muted-foreground", className)} {...restProps}>
	{@render children?.()}
</p>
