<script lang="ts">
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	// A small pulsing status dot (live/active indicator). `positive` reads as a green
	// "live" signal; `muted` is a neutral graphite "in progress" marker. The opacity
	// pulse is suppressed under prefers-reduced-motion.
	const dotVariants = tv({
		base: "dot inline-block size-1.5 shrink-0 rounded-full",
		variants: {
			tone: {
				positive: "bg-[var(--positive,oklch(0.62_0.13_152))]",
				muted: "bg-muted-foreground",
			},
		},
		defaultVariants: { tone: "muted" },
	});

	type Props = VariantProps<typeof dotVariants> & { class?: string };

	let { tone, class: className }: Props = $props();
</script>

<span class={cn(dotVariants({ tone }), className)}></span>

<style>
	@media (prefers-reduced-motion: no-preference) {
		.dot {
			animation: pulse 1.8s var(--ease) infinite;
		}
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}
</style>
