<script lang="ts">
	import type { Snippet } from "svelte";

	// Shared chrome for one registry-category group (label + trailing count + rows),
	// reused by the read-only ProductDetail and the editable ProductForm. The rows
	// themselves are passed as `children` so each host keeps its own row markup/CSS
	// (a value line vs. an editable input); this component owns only the `.ng`/`.ngh`
	// container and header. `collapsible` switches the header between an interactive
	// toggle button (with chevron) and a static heading.
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

<div class="mt-2">
	{#if collapsible}
		<button
			type="button"
			class="flex w-full items-center gap-2 border-x-0 border-t-0 border-b border-[color:var(--hairline)] bg-transparent px-0.5 py-[9px] focus-visible:rounded-sm focus-visible:shadow-[var(--focus)] focus-visible:outline-none"
			onclick={() => onToggle?.()}
		>
			<span class="text-[0.8125rem] font-semibold tracking-[-0.005em] text-foreground">{label}</span>
			<span class="ml-auto text-[0.8125rem] tabular-nums text-muted-foreground">{count}</span>
			<svg
				class="h-[15px] w-[15px] text-muted-foreground transition-transform duration-200 ease-[var(--ease)] motion-reduce:transition-none {open
					? 'rotate-180'
					: ''}"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path d="M10 13.5l-4.5-5h9z" />
			</svg>
		</button>
	{:else}
		<div class="flex w-full items-center gap-2 border-b border-[color:var(--hairline)] px-0.5 py-[9px]">
			<span class="text-[0.8125rem] font-semibold tracking-[-0.005em] text-foreground">{label}</span>
			<span class="ml-auto text-[0.8125rem] tabular-nums text-muted-foreground">{count}</span>
		</div>
	{/if}
	{#if open}
		{@render children()}
	{/if}
</div>
