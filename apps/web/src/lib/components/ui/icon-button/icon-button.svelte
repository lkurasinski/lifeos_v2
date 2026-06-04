<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	// Square control at --radius-sm, tinted background, soft shadow, no border, a
	// SOLID (filled) icon in graphite. Pass the icon as children (inline <svg>).
	const iconButtonVariants = tv({
		base: "inline-flex items-center justify-center rounded-sm text-foreground transition-[background-color,box-shadow] duration-[180ms] ease-out-quint focus-visible:outline-none focus-visible:shadow-[var(--focus)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:block",
		variants: {
			size: {
				default: "size-[38px] bg-card shadow-soft hover:bg-accent [&_svg]:size-[19px]",
				sm: "size-8 bg-accent hover:opacity-80 [&_svg]:size-4",
			},
		},
		defaultVariants: { size: "default" },
	});

	type Props = HTMLButtonAttributes &
		VariantProps<typeof iconButtonVariants> & { class?: string };

	let { class: className, size, children, ...restProps }: Props = $props();
</script>

<button class={cn(iconButtonVariants({ size }), className)} {...restProps}>
	{@render children?.()}
</button>
