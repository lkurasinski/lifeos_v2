<script lang="ts">
	import type { Snippet } from "svelte";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { cn } from "$lib/utils";

	// Sticky frosted header for the full-screen form/flow routes (recipe + product
	// create/edit). Back IconButton · title · optional trailing cancel link (or a custom
	// `actions` snippet). The glass material + sticky + fallbacks come from the shared
	// `.appbar` class (layout.css); everything else is Tailwind utilities.
	type Props = {
		title: string;
		onBack: () => void;
		backLabel: string;
		/** Trailing text button (right-aligned). Omit to render the `actions` snippet, or neither. */
		onCancel?: () => void;
		cancelLabel?: string;
		/** Custom trailing content; overrides the cancel button when provided. */
		actions?: Snippet;
		class?: string;
	};

	let { title, onBack, backLabel, onCancel, cancelLabel, actions, class: className }: Props =
		$props();
</script>

<header class={cn("appbar flex items-center gap-4 px-6 py-4 max-md:px-4 max-md:py-3", className)}>
	<IconButton onclick={onBack} aria-label={backLabel}>
		<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fill-rule="evenodd"
				d="M12.7 4.3a1 1 0 0 1 0 1.4L8.42 10l4.3 4.3a1 1 0 1 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z"
				clip-rule="evenodd"
			/>
		</svg>
	</IconButton>

	<h1 class="text-xl font-semibold tracking-[-0.015em] text-foreground">{title}</h1>

	{#if actions}
		<div class="ml-auto flex items-center gap-2">{@render actions()}</div>
	{:else if onCancel}
		<button
			type="button"
			class="ml-auto rounded-sm px-2.5 py-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			onclick={onCancel}
		>
			{cancelLabel}
		</button>
	{/if}
</header>
