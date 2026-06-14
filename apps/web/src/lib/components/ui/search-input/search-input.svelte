<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { Input } from "$lib/components/ui/input";
	import { cn } from "$lib/utils";

	// A search field: a leading magnifier glyph over an Input, with an optional clear
	// button (shown while non-empty when `onclear` is given) and an optional trailing
	// slot (e.g. a mode pill). Override the glyph via `leading`. `class` styles the
	// wrapper; `inputClass` retunes the Input (padding/scale).
	type Props = Omit<HTMLInputAttributes, "class" | "value"> & {
		class?: string;
		inputClass?: string;
		value?: string;
		/** Input element handle, for imperative focus. */
		inputEl?: HTMLInputElement | null;
		/** When provided, a clear button shows while the field is non-empty. */
		onclear?: () => void;
		clearLabel?: string;
		leading?: Snippet;
		trailing?: Snippet;
	};

	let {
		class: className,
		inputClass,
		value = $bindable(""),
		inputEl = $bindable(null),
		onclear,
		clearLabel,
		leading,
		trailing,
		...restProps
	}: Props = $props();
</script>

<div class={cn("relative", className)}>
	{#if leading}
		{@render leading()}
	{:else}
		<svg
			class="pointer-events-none absolute left-[14px] top-1/2 z-[1] size-[18px] -translate-y-1/2 text-muted-foreground"
			viewBox="0 0 20 20"
			fill="currentColor"
			aria-hidden="true"
		>
			<path
				fill-rule="evenodd"
				d="M9 3.5a5.5 5.5 0 1 0 3.4 9.82l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
				clip-rule="evenodd"
			/>
		</svg>
	{/if}
	<Input bind:value bind:ref={inputEl} type="text" class={cn("px-[42px]", inputClass)} {...restProps} />
	{#if trailing}{@render trailing()}{/if}
	{#if onclear && value.length > 0}
		<IconButton
			type="button"
			variant="ghost"
			size="sm"
			class="absolute right-[7px] top-1/2 size-[30px] -translate-y-1/2 [&_svg]:size-[18px]"
			aria-label={clearLabel}
			onclick={onclear}
		>
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM7.7 6.64a.75.75 0 0 0-1.06 1.06L8.94 10l-2.3 2.3a.75.75 0 1 0 1.06 1.06l2.3-2.3 2.3 2.3a.75.75 0 1 0 1.06-1.06L11.06 10l2.3-2.3a.75.75 0 0 0-1.06-1.06l-2.3 2.3-2.3-2.3Z"
					clip-rule="evenodd"
				/>
			</svg>
		</IconButton>
	{/if}
</div>
