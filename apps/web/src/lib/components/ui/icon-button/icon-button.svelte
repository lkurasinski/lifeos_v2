<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	// Square icon control at --radius-sm. `size` sets the box + glyph dimensions;
	// `variant` sets the surface:
	//   solid  — filled card + soft shadow (toolbar / pagination default)
	//   subtle — flat accent fill (compact in-bar controls)
	//   ghost  — transparent until hover (inline remove / clear / close)
	// Pass the icon as children (inline <svg>); it renders SOLID (filled) in graphite.
	const iconButtonVariants = tv({
		base: "inline-flex items-center justify-center rounded-sm transition-[background-color,box-shadow,color] duration-[180ms] ease-out-quint focus-visible:outline-none focus-visible:shadow-[var(--focus)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:block",
		variants: {
			variant: {
				solid: "bg-card text-foreground shadow-soft hover:bg-accent",
				subtle: "bg-accent text-foreground hover:opacity-80",
				ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
			},
			size: {
				default: "size-[38px] [&_svg]:size-[19px]",
				sm: "size-8 [&_svg]:size-4",
			},
		},
		defaultVariants: { variant: "solid", size: "default" },
	});

	type Props = HTMLButtonAttributes &
		VariantProps<typeof iconButtonVariants> & { class?: string };

	let { class: className, variant, size, children, ...restProps }: Props = $props();
</script>

<button class={cn(iconButtonVariants({ variant, size }), className)} {...restProps}>
	{@render children?.()}
</button>
