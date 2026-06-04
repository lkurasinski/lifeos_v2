<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	// The signature figure: large, thin (300), tabular-aligned. The number the
	// user came to see. Unit renders as a small muted superscript suffix. Sit it
	// on a solid/thick backing where it must stay legible over glass.
	const metricVariants = tv({
		base: "inline-flex items-baseline font-light leading-none tracking-[-0.02em] tabular-nums text-foreground",
		variants: {
			size: {
				sm: "text-[2rem]",
				default: "text-[3rem]",
				lg: "text-[3.75rem]",
			},
		},
		defaultVariants: { size: "default" },
	});

	type Props = HTMLAttributes<HTMLSpanElement> &
		VariantProps<typeof metricVariants> & {
			value: string | number;
			unit?: string;
			class?: string;
		};

	let { class: className, size, value, unit, ...restProps }: Props = $props();
</script>

<span class={cn(metricVariants({ size }), className)} {...restProps}>
	{value}{#if unit}<span class="ml-[0.2em] translate-y-[-0.7em] text-[0.36em] font-medium tracking-normal text-muted-foreground">{unit}</span>{/if}
</span>
