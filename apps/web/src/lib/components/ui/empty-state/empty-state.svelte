<script lang="ts">
	import { cn } from "$lib/utils";

	// Centered "no results" block for catalog list columns (empty search / empty drafts).
	// Title + secondary hint, generous vertical padding. Plain text only.
	type Props = {
		title: string;
		hint?: string;
		class?: string;
	};

	let { title, hint, class: className }: Props = $props();
</script>

<div class={cn("px-6 py-16 text-center", className)}>
	<p class="text-base font-[550] text-foreground">{title}</p>
	{#if hint}
		<p class="mt-1.5 text-sm text-muted-foreground">{hint}</p>
	{/if}
</div>
