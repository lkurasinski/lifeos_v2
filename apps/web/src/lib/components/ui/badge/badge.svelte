<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	// Neutral capsule for source / category / label metadata. Monochrome by
	// design — semantic colour belongs to Status, identity colour to category
	// icons. Keep this off the scored-data palette.
	const badgeVariants = tv({
		base: "inline-flex items-center gap-1 rounded-pill px-[9px] py-1 text-[0.625rem] font-semibold uppercase leading-none tracking-[0.07em]",
		variants: {
			variant: {
				default: "bg-secondary text-muted-foreground",
				outline: "border border-border text-muted-foreground",
				muted: "bg-muted text-muted-foreground",
			},
		},
		defaultVariants: { variant: "default" },
	});

	type Props = HTMLAttributes<HTMLSpanElement> &
		VariantProps<typeof badgeVariants> & { class?: string };

	let { class: className, variant, children, ...restProps }: Props = $props();
</script>

<span class={cn(badgeVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</span>
