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

<div class="ng">
	{#if collapsible}
		<button type="button" class="ngh" class:open onclick={() => onToggle?.()}>
			<span class="gt">{label}</span>
			<span class="gx">{count}</span>
			<svg class="chev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path d="M10 13.5l-4.5-5h9z" />
			</svg>
		</button>
	{:else}
		<div class="ngh">
			<span class="gt">{label}</span>
			<span class="gx">{count}</span>
		</div>
	{/if}
	{#if open}
		{@render children()}
	{/if}
</div>

<style>
	.ng {
		margin-top: 8px;
	}
	.ngh {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 9px 2px;
		border-bottom: 1px solid var(--hairline);
	}
	/* Interactive (collapsible) header resets button chrome. */
	button.ngh {
		border-top: 0;
		border-left: 0;
		border-right: 0;
		background: transparent;
		cursor: pointer;
		font-family: inherit;
	}
	button.ngh:focus-visible {
		outline: none;
		box-shadow: var(--focus);
		border-radius: var(--radius-sm);
	}
	.gt {
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--foreground);
	}
	.gx {
		margin-left: auto;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground);
	}
	.chev {
		width: 15px;
		height: 15px;
		color: var(--muted-foreground);
		transition: transform 0.2s var(--ease);
	}
	.ngh.open .chev {
		transform: rotate(180deg);
	}
	@media (prefers-reduced-motion: reduce) {
		.chev {
			transition: none;
		}
	}
</style>
