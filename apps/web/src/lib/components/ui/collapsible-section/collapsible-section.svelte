<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils";

	// A section with a header row and a body that collapses behind a rotating chevron.
	// The header content (label, count, etc.) is the `header` snippet so each host keeps
	// its own typography; this owns the toggle button, the chevron rotation, and the
	// show/hide. State is controlled — pass `open` + `onToggle`. `collapsible={false}`
	// renders a static heading (no button, no chevron, body always shown). `chevronClass`
	// positions/sizes the chevron (e.g. "ml-auto size-[17px]"); `buttonClass` styles the
	// header row.
	type Props = {
		open?: boolean;
		onToggle?: () => void;
		collapsible?: boolean;
		buttonClass?: string;
		chevronClass?: string;
		header: Snippet;
		children: Snippet;
	};

	let {
		open = true,
		onToggle,
		collapsible = true,
		buttonClass,
		chevronClass,
		header,
		children,
	}: Props = $props();
</script>

{#if collapsible}
	<button
		type="button"
		class={cn(
			"flex w-full items-center gap-2 bg-transparent focus-visible:rounded-sm focus-visible:shadow-[var(--focus)] focus-visible:outline-none",
			buttonClass,
		)}
		aria-expanded={open}
		onclick={() => onToggle?.()}
	>
		{@render header()}
		<svg
			class={cn(
				"size-[15px] text-muted-foreground transition-transform duration-200 ease-[var(--ease)] motion-reduce:transition-none",
				open && "rotate-180",
				chevronClass,
			)}
			viewBox="0 0 20 20"
			fill="currentColor"
			aria-hidden="true"
		>
			<path d="M10 13.5l-4.5-5h9z" />
		</svg>
	</button>
{:else}
	<div class={cn("flex w-full items-center gap-2", buttonClass)}>
		{@render header()}
	</div>
{/if}
{#if open}
	{@render children()}
{/if}
