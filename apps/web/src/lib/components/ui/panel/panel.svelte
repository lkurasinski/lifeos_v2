<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	// Borderless spatial-glass surface. Depth tiers replace nesting — never put a
	// glass panel inside another glass panel. `solid` backs hero metrics / dense
	// data so numbers never wash out. Material + fallback live in layout.css.
	const panelVariants = tv({
		base: "panel",
		variants: {
			variant: {
				regular: "",
				thick: "panel--thick",
				solid: "panel--solid",
			},
		},
		defaultVariants: { variant: "regular" },
	});

	type Props = HTMLAttributes<HTMLDivElement> &
		VariantProps<typeof panelVariants> & { class?: string };

	let { class: className, variant, children, ...restProps }: Props = $props();
</script>

<div class={cn(panelVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</div>
