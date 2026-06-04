<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";
	import type { Tone } from "../status/status.svelte";

	// Macro-vs-target adherence bar: a thin rounded track with a scored fill.
	// `tone` carries the only colour on the row (under / near / over target).
	// Fill animates from its current width only when motion is allowed.
	type Props = HTMLAttributes<HTMLDivElement> & {
		/** Fill amount, 0–100 (%). */
		value?: number;
		tone?: Tone;
		class?: string;
	};

	let { class: className, value = 0, tone = "positive", ...restProps }: Props = $props();

	const pct = $derived(Math.max(0, Math.min(100, value)));
	const fillTone = $derived(
		{ positive: "bg-positive", caution: "bg-caution", destructive: "bg-destructive" }[tone],
	);
</script>

<div
	class={cn("h-[7px] w-full overflow-hidden rounded-pill bg-accent", className)}
	role="progressbar"
	aria-valuenow={pct}
	aria-valuemin={0}
	aria-valuemax={100}
	{...restProps}
>
	<div
		class={cn("h-full rounded-pill motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out-expo", fillTone)}
		style="width:{pct}%"
	></div>
</div>
