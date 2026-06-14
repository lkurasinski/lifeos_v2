<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	// The capsule shared by the catalog category facets and the recipe facet groups, plus the
	// read-only recipe-detail tags. `filter` carries active/inactive toggle state (active =
	// primary fill, inactive = secondary with an accent hover); `ghost` is the underlined text
	// toggle (the recipe "Więcej filtrów" control); `tag` is a NON-interactive display capsule
	// (rendered as a <span>, e.g. the detail diet/technique/allergen tags). An optional `leading`
	// icon tightens the left padding; a `count` renders as a trailing tabular figure when > 0.
	const chipVariants = tv({
		base: "inline-flex cursor-pointer items-center gap-1.5 rounded-pill border-0 text-[0.8125rem] font-medium transition-colors duration-[180ms] ease-[var(--ease)] focus-visible:shadow-[var(--focus)] focus-visible:outline-none motion-reduce:transition-none",
		variants: {
			variant: {
				filter: "py-1.5",
				ghost:
					"bg-transparent px-1 py-1.5 text-foreground underline decoration-[var(--border)] underline-offset-[3px] hover:decoration-[var(--muted-foreground)]",
				// Static display tag — overrides the interactive base (cursor/text size) via tw-merge.
				tag: "cursor-default bg-secondary px-2.5 py-1 text-[0.75rem] text-muted-foreground",
			},
			active: { true: "", false: "" },
		},
		compoundVariants: [
			{ variant: "filter", active: true, class: "bg-primary text-primary-foreground" },
			{
				variant: "filter",
				active: false,
				class: "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground",
			},
		],
		defaultVariants: { variant: "filter", active: false },
	});

	type Props = HTMLButtonAttributes &
		VariantProps<typeof chipVariants> & {
			class?: string;
			/** Trailing count (e.g. a facet hit count) — rendered only when > 0. */
			count?: number;
			/** Optional leading glyph; its presence tightens the left padding. */
			leading?: Snippet;
			children: Snippet;
		};

	let {
		class: className,
		variant = "filter",
		active = false,
		count,
		leading,
		children,
		...restProps
	}: Props = $props();
</script>

{#if variant === "tag"}
	<!-- Non-interactive display tag — a <span>, not a button (no click/focus semantics). -->
	<span class={cn(chipVariants({ variant, active }), leading && "pl-2", className)}>
		{#if leading}{@render leading()}{/if}
		{@render children()}
		{#if count !== undefined && count > 0}
			<span class="ml-1 tabular-nums opacity-60">{count}</span>
		{/if}
	</span>
{:else}
	<button
		type="button"
		class={cn(
			chipVariants({ variant, active }),
			variant === "filter" && (leading ? "pl-[9px] pr-3" : "px-3"),
			className,
		)}
		{...restProps}
	>
		{#if leading}{@render leading()}{/if}
		{@render children()}
		{#if count !== undefined && count > 0}
			<span class="ml-1 tabular-nums opacity-60">{count}</span>
		{/if}
	</button>
{/if}
