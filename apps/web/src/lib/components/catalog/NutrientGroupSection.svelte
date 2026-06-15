<script lang="ts">
	import type { Snippet } from "svelte";
	import { CollapsibleSection } from "$lib/components/ui/collapsible-section";

	// Shared chrome for one registry-category group (label + trailing count + rows),
	// reused by the read-only ProductDetail and the editable ProductForm. A thin domain
	// wrapper over CollapsibleSection that pins the nutrient-group header style (bordered
	// row, semibold label, trailing count). The rows are passed as `children` so each
	// host keeps its own row markup. `collapsible` switches between a toggle and a static
	// heading.
	type Props = {
		label: string;
		/** Trailing count text — e.g. "3/8" (filled/total) or "5 pozycji". */
		count: string;
		/** Interactive collapse toggle (form) vs. a static heading (detail). */
		collapsible?: boolean;
		/** Whether the body is shown. Always true when not collapsible. */
		open?: boolean;
		onToggle?: () => void;
		children: Snippet;
	};

	let { label, count, collapsible = false, open = true, onToggle, children }: Props = $props();
</script>

{#snippet groupHeader()}
	<span class="text-[0.8125rem] font-semibold tracking-[-0.005em] text-foreground">{label}</span>
	<span class="ml-auto text-[0.8125rem] tabular-nums text-muted-foreground">{count}</span>
{/snippet}

<div class="mt-2">
	<CollapsibleSection
		{collapsible}
		{open}
		{onToggle}
		buttonClass="border-b border-[color:var(--hairline)] px-0.5 py-[9px]"
		header={groupHeader}
	>
		{@render children()}
	</CollapsibleSection>
</div>
