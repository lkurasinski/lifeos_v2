<script lang="ts">
	import { categoryGlyph } from "./meta";

	// Identity glyph for a food category — colour ENCODES which category (the locked
	// catalog exception), never a score. The inner markup is a developer-authored
	// constant from meta.ts, so {@html} is safe here (no user data).
	type Props = {
		slug: string | null | undefined;
		size?: number;
		class?: string;
	};

	let { slug, size = 15, class: className }: Props = $props();

	const glyph = $derived(categoryGlyph(slug));
</script>

<svg
	class={className}
	viewBox="0 0 20 20"
	fill="currentColor"
	aria-hidden="true"
	style="color:{glyph.cc};width:{size}px;height:{size}px;flex-shrink:0"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html glyph.inner}
</svg>
