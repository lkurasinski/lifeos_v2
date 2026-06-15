<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { SegmentedToggle } from "$lib/components/ui/segmented";
	import { cn } from "$lib/utils";

	// A floating picker panel anchored below its trigger (the trigger's wrapper must be
	// `relative`). Card surface with a lift shadow; an optional segmented tab bar at the
	// top. Search field, result list, and any footer action are the default slot. Tab
	// selection is reported via `onTabChange` so the host can drive its own state/types.
	// The tab bar is a full-width `SegmentedToggle` (Bits UI ToggleGroup), so keyboard
	// navigation, roving focus, and selection semantics come for free.
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
			<SegmentedToggle block items={tabs} value={activeTab} onValueChange={onTabChange} />
		{/if}
		{@render children()}
	</div>
{/if}
