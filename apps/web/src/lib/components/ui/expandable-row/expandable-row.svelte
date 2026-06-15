<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	// A list row that expands in place: a leading chevron (points right when closed,
	// down when open) followed by header content, with a body revealed below when open.
	// Controlled via `open` + `onToggle`. `rowClass` styles the trigger row so each host
	// keeps its own layout; `chevronClass` sizes the chevron; the body is the default
	// slot (the host wraps it in its own container). Rest props land on the trigger
	// button (e.g. `data-*`); the body is associated via `aria-controls` for screen readers.
	type Props = HTMLButtonAttributes & {
		open?: boolean;
		onToggle?: () => void;
		rowClass?: string;
		chevronClass?: string;
		header: Snippet;
		children: Snippet;
	};

	let {
		open = false,
		onToggle,
		rowClass,
		chevronClass,
		header,
		children,
		...restProps
	}: Props = $props();

	const bodyId = $props.id();
</script>

<button
	{...restProps}
	type="button"
	class={cn(
		"flex w-full items-center gap-2.5 bg-transparent text-left focus-visible:rounded-sm focus-visible:shadow-[var(--focus)] focus-visible:outline-none",
		rowClass,
	)}
	aria-expanded={open}
	aria-controls={bodyId}
	onclick={() => onToggle?.()}
>
	<svg
		class={cn(
			"size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[var(--ease)] motion-reduce:transition-none",
			open ? "rotate-0" : "-rotate-90",
			chevronClass,
		)}
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M10 13.5l-4.5-5h9z" />
	</svg>
	{@render header()}
</button>
{#if open}
	<div id={bodyId}>
		{@render children()}
	</div>
{/if}
