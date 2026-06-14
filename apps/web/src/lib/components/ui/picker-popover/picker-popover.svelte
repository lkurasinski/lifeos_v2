<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils";

	// A floating picker panel anchored below its trigger (the trigger's wrapper must be
	// `relative`). Card surface with a lift shadow; an optional segmented tab bar at the
	// top. Search field, result list, and any footer action are the default slot. Tab
	// selection is reported via `onTabChange` so the host can drive its own state/types.
	type Tab = { value: string; label: string };
	type Props = {
		open?: boolean;
		class?: string;
		tabs?: Tab[];
		activeTab?: string;
		onTabChange?: (value: string) => void;
		children: Snippet;
	};

	let { open = false, class: className, tabs, activeTab, onTabChange, children }: Props = $props();
</script>

{#if open}
	<div
		class={cn(
			"absolute inset-x-0 top-[calc(100%+7px)] z-40 flex flex-col gap-2 rounded-[var(--radius)] bg-card p-[9px] shadow-lift",
			className,
		)}
	>
		{#if tabs}
			<div class="flex rounded-pill bg-accent p-[3px]">
				{#each tabs as tab (tab.value)}
					<button
						type="button"
						class={cn(
							"flex-1 cursor-pointer rounded-pill border-0 bg-transparent px-3 py-[5px] text-xs font-medium text-muted-foreground",
							activeTab === tab.value && "bg-card text-foreground shadow-soft",
						)}
						onclick={() => onTabChange?.(tab.value)}
					>
						{tab.label}
					</button>
				{/each}
			</div>
		{/if}
		{@render children()}
	</div>
{/if}
