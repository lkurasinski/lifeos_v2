<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	type Props = HTMLAttributes<HTMLHeadingElement> & { class?: string };

	let { class: className, children, ...restProps }: Props = $props();
</script>

<h3 class={cn("text-[1.125rem] font-medium leading-[1.3] tracking-[-0.01em]", className)} {...restProps}>
	{@render children?.()}
</h3>
