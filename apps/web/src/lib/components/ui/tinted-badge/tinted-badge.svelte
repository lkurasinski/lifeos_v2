<script lang="ts">
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	// A small icon in a tinted circular badge — a soft, coloured marker for callouts
	// and timeline steps (e.g. the recipe "wait" step). `tone` carries the hue away
	// from the monochrome system on purpose, so reserve it for genuine accent markers.
	// Pass the icon as children (inline <svg>).
	const tintedBadgeVariants = tv({
		base: "inline-flex shrink-0 items-center justify-center rounded-full [&_svg]:size-[14px]",
		variants: {
			tone: {
				amber: "bg-[oklch(0.78_0.13_78_/_0.22)] text-[oklch(0.52_0.1_74)]",
				positive: "bg-[oklch(0.62_0.13_152_/_0.18)] text-[oklch(0.46_0.12_152)]",
				info: "bg-[oklch(0.62_0.12_250_/_0.18)] text-[oklch(0.5_0.12_250)]",
			},
			size: {
				default: "size-[26px]",
				sm: "size-5 [&_svg]:size-3",
			},
		},
		defaultVariants: { tone: "amber", size: "default" },
	});

	type Props = VariantProps<typeof tintedBadgeVariants> & {
		class?: string;
		children: import("svelte").Snippet;
	};

	let { tone, size, class: className, children }: Props = $props();
</script>

<span class={cn(tintedBadgeVariants({ tone, size }), className)}>
	{@render children()}
</span>
