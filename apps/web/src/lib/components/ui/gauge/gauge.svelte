<script lang="ts" module>
	// Which macro a ring represents — drives its fixed identity hue. Scoped
	// exception to "colour only on scored data": catalog rings encode WHICH macro
	// (reference data), not how a value scores against a target. Each hue pairs a
	// full tone (--gc), a lighter sweep start (--gc-s) and a faint same-hue track
	// (--trk) so an empty ring still reads coloured. Values from lifeos-kit.css.
	export type Macro = "kcal" | "pro" | "carb" | "fat";

	const MACRO: Record<Macro, string> = {
		kcal: "--gc:oklch(0.64 0.15 30);--gc-s:oklch(0.76 0.115 34);--trk:oklch(0.915 0.034 32)",
		pro: "--gc:oklch(0.6 0.12 245);--gc-s:oklch(0.74 0.095 244);--trk:oklch(0.912 0.028 244)",
		carb: "--gc:oklch(0.66 0.1 182);--gc-s:oklch(0.79 0.08 184);--trk:oklch(0.918 0.026 183)",
		fat: "--gc:oklch(0.8 0.13 92);--gc-s:oklch(0.89 0.095 95);--trk:oklch(0.93 0.035 92)",
	};
</script>

<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	// Presentational, read-only macro ring (the locked catalog gauge): thin conic
	// donut with a sweep + glow + rounded end cap, an inner disc behind a graphite
	// figure, a baseline-aligned unit, and an optional label with a colour dot.
	// Colour lives in the ring/dot only — never on the figure.
	type Props = HTMLAttributes<HTMLDivElement> & {
		/** Ring fill, 0–100 (%) — "how rich in this macro", not a score. */
		value?: number;
		/** The figure shown in the centre (kept graphite). */
		display?: string | number;
		unit?: string;
		label?: string;
		macro?: Macro;
		size?: number;
		class?: string;
	};

	let {
		class: className,
		value = 0,
		display,
		unit,
		label,
		macro = "kcal",
		size = 84,
		...restProps
	}: Props = $props();

	const pct = $derived(Math.max(0, Math.min(100, value)));
</script>

<div class={cn("gw", className)} style="--size:{size}px;{MACRO[macro]}" {...restProps}>
	<div class="gauge" style="--p:{pct}">
		<span class="grglow"></span>
		<span class="grring"></span>
		<span class="gdisc"></span>
		{#if pct > 0}<span class="cap"></span>{/if}
		{#if display !== undefined}
			<span class="gv">{display}{#if unit}<span class="unit">{unit}</span>{/if}</span>
		{/if}
	</div>
	{#if label}
		<span class="glab"><span class="gdot"></span>{label}</span>
	{/if}
</div>

<style>
	.gw {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	.gauge {
		position: relative;
		width: var(--size);
		height: var(--size);
		--w: 5px;
	}
	.grring,
	.grglow {
		position: absolute;
		inset: 0;
		border-radius: 50%;
	}
	/* sweep start -> full tone across the arc, then the faint track */
	.grring {
		background: conic-gradient(
			var(--gc-s) 0,
			var(--gc) calc(var(--p) * 1%),
			var(--trk) calc(var(--p) * 1% + 0.5%)
		);
		-webkit-mask: radial-gradient(
			circle at 50% 50%,
			transparent calc(50% - var(--w)),
			#000 calc(50% - var(--w) + 0.5px)
		);
		mask: radial-gradient(
			circle at 50% 50%,
			transparent calc(50% - var(--w)),
			#000 calc(50% - var(--w) + 0.5px)
		);
	}
	/* soft glow only under the active arc — a separate blurred layer */
	.grglow {
		background: conic-gradient(var(--gc) 0 calc(var(--p) * 1%), transparent calc(var(--p) * 1%));
		filter: blur(5px);
		opacity: 0.5;
	}
	/* inner disc: near-solid backing so the figure never washes out (theme-safe) */
	.gdisc {
		position: absolute;
		inset: calc(var(--w) - 0.5px);
		border-radius: 50%;
		background: radial-gradient(
			125% 125% at 50% 16%,
			var(--card),
			color-mix(in oklch, var(--card) 70%, var(--background))
		);
		box-shadow: inset 0 1px 1.5px oklch(1 0 0 / 0.4);
	}
	/* knob = stroke thickness, no outline -> arc ends in a rounded point */
	.cap {
		position: absolute;
		left: 50%;
		top: 50%;
		width: var(--w);
		height: var(--w);
		margin: calc(var(--w) / -2);
		border-radius: 50%;
		z-index: 3;
		background: var(--gc);
		transform: rotate(calc(var(--p) * 3.6deg)) translateY(calc(var(--size) / -2 + var(--w) / 2));
	}
	.gv {
		position: absolute;
		inset: 0;
		z-index: 2;
		text-align: center;
		line-height: var(--size);
		font-weight: 300;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		font-size: 1.1875rem;
		color: var(--foreground);
	}
	/* unit aligned to the figure's baseline, not superscript */
	.gv .unit {
		font-size: 0.36em;
		font-weight: 500;
		color: var(--muted-foreground);
		margin-left: 0.14em;
		vertical-align: baseline;
	}
	.glab {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--foreground);
	}
	.gdot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--gc);
		flex-shrink: 0;
	}
</style>
