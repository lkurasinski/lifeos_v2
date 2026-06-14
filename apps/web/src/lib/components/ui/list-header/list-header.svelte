<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils";

	// Sticky frosted header for the catalog list routes (recipes + foods). Brand block
	// (title + count·basis caption) · search slot · trailing actions slot. The glass
	// material comes from the shared `.appbar` class; the inner bar centers at the page's
	// `--content-max` and stacks below 768px. Pass the search field and the add button as
	// snippets so each catalog keeps its own bindings.
	type Props = {
		title: string;
		/** Pre-formatted total (e.g. a pl-PL grouped number); rendered bold + tabular. */
		count: string;
		/** Text after the count, e.g. "produktów · na 100 g". */
		caption: string;
		/** Min width for the bold count so the caption doesn't jump as the total changes. */
		countMinCh?: number;
		search?: Snippet;
		actions?: Snippet;
		class?: string;
	};

	let { title, count, caption, countMinCh = 3, search, actions, class: className }: Props =
		$props();
</script>

<header class={cn("appbar px-6 py-[18px] max-md:px-4", className)}>
	<div
		class="mx-auto flex max-w-[var(--content-max,1600px)] items-center gap-5 max-md:flex-col max-md:items-stretch max-md:gap-3"
	>
		<div class="shrink-0">
			<h1 class="text-xl font-semibold tracking-[-0.015em] text-foreground">{title}</h1>
			<p class="mt-px text-[0.8125rem] tabular-nums text-muted-foreground">
				<b class="inline-block font-medium text-foreground" style:min-width="{countMinCh}ch">{count}</b>
				{caption}
			</p>
		</div>

		{@render search?.()}

		{#if actions}
			<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
		{/if}
	</div>
</header>
