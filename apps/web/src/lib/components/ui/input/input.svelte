<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	// `default` — the standard bordered card field (h-11). `seamless` — borderless
	// until interaction: a faint border on hover, card fill + focus ring on focus,
	// for inline/title fields that should read as text until edited (size + font
	// come from the call site so it can host any scale).
	const inputVariants = tv({
		base: "w-full rounded-sm text-foreground caret-primary transition-[border-color,box-shadow] duration-[180ms] ease-out-quint placeholder:text-muted-foreground/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
		variants: {
			variant: {
				default:
					"flex h-11 border border-input bg-card px-3.5 text-[0.9375rem] focus-visible:border-transparent focus-visible:shadow-[var(--focus)]",
				seamless:
					"border border-transparent bg-transparent hover:border-[color:var(--border)] focus-visible:border-transparent focus-visible:bg-card focus-visible:shadow-[var(--focus)]",
			},
		},
		defaultVariants: { variant: "default" },
	});

	type Props = HTMLInputAttributes &
		VariantProps<typeof inputVariants> & { class?: string; value?: string };

	let { class: className, variant, value = $bindable(""), ...restProps }: Props = $props();
</script>

<input class={cn(inputVariants({ variant }), className)} bind:value {...restProps} />
