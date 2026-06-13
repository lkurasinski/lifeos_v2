<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils";

	// Dashed-border placeholder that holds open a detail/preview column before a selection
	// is made (catalog detail panes + the product add flow's preview pane). Centered icon +
	// prompt. Defaults to a search glyph; pass `icon` to override.
	type Props = {
		text: string;
		icon?: Snippet;
		class?: string;
	};

	let { text, icon, class: className }: Props = $props();
</script>

<div
	class={cn(
		"flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed border-[color:var(--hairline)] p-8 text-center text-muted-foreground",
		className,
	)}
>
	{#if icon}
		{@render icon()}
	{:else}
		<svg class="size-[30px] opacity-60" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fill-rule="evenodd"
				d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
				clip-rule="evenodd"
			/>
		</svg>
	{/if}
	<p class="max-w-[26ch] text-sm">{text}</p>
</div>
