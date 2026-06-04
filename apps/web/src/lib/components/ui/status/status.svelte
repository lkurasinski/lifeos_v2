<script lang="ts" module>
	// Semantic read on a value scored against the user's target. The only place,
	// alongside MacroBar / gauges-as-score, colour is allowed on status.
	export type Tone = "positive" | "caution" | "destructive";
</script>

<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	const statusVariants = tv({
		base: "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-[3px] text-[0.6875rem] font-medium leading-none tracking-[0.04em]",
		variants: {
			tone: {
				positive:
					"bg-[oklch(0.66_0.13_150)]/14 text-[oklch(0.46_0.12_150)] dark:bg-[oklch(0.7_0.135_150)]/22 dark:text-[oklch(0.82_0.13_150)]",
				caution:
					"bg-[oklch(0.78_0.13_78)]/18 text-[oklch(0.48_0.1_70)] dark:bg-[oklch(0.805_0.13_80)]/22 dark:text-[oklch(0.85_0.12_85)]",
				destructive:
					"bg-[oklch(0.605_0.19_28)]/14 text-[oklch(0.5_0.16_28)] dark:bg-[oklch(0.65_0.18_28)]/24 dark:text-[oklch(0.78_0.16_28)]",
			},
		},
		defaultVariants: { tone: "positive" },
	});

	type Props = HTMLAttributes<HTMLSpanElement> & {
		tone?: Tone;
		class?: string;
	};

	let { class: className, tone, children, ...restProps }: Props = $props();
</script>

<span class={cn(statusVariants({ tone }), className)} {...restProps}>
	{@render children?.()}
</span>
