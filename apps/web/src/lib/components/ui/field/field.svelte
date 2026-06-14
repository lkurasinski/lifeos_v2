<script lang="ts">
	import type { Snippet } from "svelte";
	import { Label } from "$lib/components/ui/label";
	import { cn } from "$lib/utils";

	// A labelled form control. `vertical` (default) stacks Label over the control with
	// optional error/hint beneath — the standard form/auth field. `horizontal` is a
	// settings-style row: muted label on the left, control on the right, wrapped in a
	// <label> so the whole row focuses the control. `labelAction` renders a trailing
	// element in the label row (e.g. a "forgot password?" link). The control is the
	// default slot.
	type Props = {
		label: string;
		for?: string;
		orientation?: "vertical" | "horizontal";
		error?: string;
		hint?: string;
		class?: string;
		labelAction?: Snippet;
		children: Snippet;
	};

	let {
		label,
		for: htmlFor,
		orientation = "vertical",
		error,
		hint,
		class: className,
		labelAction,
		children,
	}: Props = $props();
</script>

{#if orientation === "horizontal"}
	<label class={cn("flex items-center justify-between gap-3", className)}>
		<span class="text-[0.8125rem] text-muted-foreground">{label}</span>
		{@render children()}
	</label>
{:else}
	<div class={cn("flex flex-col gap-1.5", className)}>
		{#if labelAction}
			<div class="flex items-center justify-between">
				<Label for={htmlFor}>{label}</Label>
				{@render labelAction()}
			</div>
		{:else}
			<Label for={htmlFor}>{label}</Label>
		{/if}
		{@render children()}
		{#if error}
			<p class="text-[0.6875rem] text-destructive">{error}</p>
		{/if}
		{#if hint}
			<p class="text-[0.6875rem] leading-[1.4] text-muted-foreground">{hint}</p>
		{/if}
	</div>
{/if}
