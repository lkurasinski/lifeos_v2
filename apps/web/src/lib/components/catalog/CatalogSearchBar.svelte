<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import { t } from "$lib/i18n";

	// Topbar product search. Composes the kit Input with a leading glyph and a custom
	// clear affordance (the native type=search "×" is suppressed). The parent owns
	// debounce + URL navigation; this is a controlled field via bind:value.
	type Props = {
		value?: string;
		placeholder?: string;
		oninput?: () => void;
		onclear?: () => void;
	};

	let { value = $bindable(""), placeholder, oninput, onclear }: Props = $props();

	function clear() {
		value = "";
		onclear?.();
	}
</script>

<div class="relative max-w-[520px] flex-1">
	<svg
		class="pointer-events-none absolute left-[14px] top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
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
	<Input type="text" {placeholder} bind:value {oninput} class="px-[42px]" />
	{#if value.length > 0}
		<button
			type="button"
			class="absolute right-[7px] top-1/2 inline-flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-sm border-0 bg-transparent text-muted-foreground transition-colors duration-150 ease-[var(--ease)] hover:bg-accent hover:text-foreground focus-visible:shadow-[var(--focus)] focus-visible:outline-none motion-reduce:transition-none"
			aria-label={t("catalog.clearSearch")}
			onclick={clear}
		>
			<svg class="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM7.7 6.64a.75.75 0 0 0-1.06 1.06L8.94 10l-2.3 2.3a.75.75 0 1 0 1.06 1.06l2.3-2.3 2.3 2.3a.75.75 0 1 0 1.06-1.06L11.06 10l2.3-2.3a.75.75 0 0 0-1.06-1.06l-2.3 2.3-2.3-2.3Z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	{/if}
</div>
