<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { tv } from "tailwind-variants";
	import { cn } from "$lib/utils";
	import type { Tone } from "./status.svelte";

	// Bare semantic dot — the smallest possible "on track / approaching / over"
	// read, for inline use beside a label or value.
	const dotVariants = tv({
		base: "inline-block size-[9px] shrink-0 rounded-full",
		variants: {
			tone: {
				positive: "bg-positive",
				caution: "bg-caution",
				destructive: "bg-destructive",
			},
		},
		defaultVariants: { tone: "positive" },
	});

	type Props = HTMLAttributes<HTMLSpanElement> & {
		tone?: Tone;
		class?: string;
	};

	let { class: className, tone, ...restProps }: Props = $props();
</script>

<span aria-hidden="true" class={cn(dotVariants({ tone }), className)} {...restProps}></span>
