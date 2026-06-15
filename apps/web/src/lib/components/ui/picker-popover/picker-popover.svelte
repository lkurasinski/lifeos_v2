<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	// A floating picker panel anchored below its trigger (the trigger's wrapper must be
	// `relative`). Card surface with a lift shadow; an optional segmented tab bar at the
	// top. Search field, result list, and any footer action are the default slot. Tab
	// selection is reported via `onTabChange` so the host can drive its own state/types.
	// The tab bar is a proper ARIA `tablist`: arrow keys move between tabs and roving
	// tabindex keeps a single tab in the focus order.
	type Tab = { value: string; label: string };
	type Props = HTMLAttributes<HTMLDivElement> & {
		open?: boolean;
		tabs?: Tab[];
		activeTab?: string;
		onTabChange?: (value: string) => void;
		children: Snippet;
	};

	let {
		open = false,
		class: className,
		tabs,
		activeTab,
		onTabChange,
		children,
		...restProps
	}: Props = $props();

	let tabEls = $state<HTMLButtonElement[]>([]);

	// Roving focus: ArrowLeft/Right select the adjacent tab and move focus to it.
	function onTabKeydown(e: KeyboardEvent, i: number, list: Tab[]) {
		if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
		e.preventDefault();
		const dir = e.key === "ArrowRight" ? 1 : -1;
		const next = (i + dir + list.length) % list.length;
		onTabChange?.(list[next].value);
		tabEls[next]?.focus();
	}
</script>

{#if open}
	<div
		class={cn(
			"absolute inset-x-0 top-[calc(100%+7px)] z-40 flex flex-col gap-2 rounded-[var(--radius)] bg-card p-[9px] shadow-lift",
			className,
		)}
		{...restProps}
	>
		{#if tabs}
			<div class="flex rounded-pill bg-accent p-[3px]" role="tablist">
				{#each tabs as tab, i (tab.value)}
					<button
						bind:this={tabEls[i]}
						type="button"
						role="tab"
						aria-selected={activeTab === tab.value}
						tabindex={activeTab === tab.value ? 0 : -1}
						class={cn(
							"flex-1 cursor-pointer rounded-pill border-0 bg-transparent px-3 py-[5px] text-xs font-medium text-muted-foreground focus-visible:shadow-[var(--focus)] focus-visible:outline-none",
							activeTab === tab.value && "bg-card text-foreground shadow-soft",
						)}
						onclick={() => onTabChange?.(tab.value)}
						onkeydown={(e) => onTabKeydown(e, i, tabs)}
					>
						{tab.label}
					</button>
				{/each}
			</div>
		{/if}
		{@render children()}
	</div>
{/if}
