<script lang="ts">
	import { resolve } from "$app/paths";
	import type { Pathname } from "$app/types";

	// The centered account-switch line at the foot of an auth form (e.g. "No account?
	// Register"). `holo` opts into the staggered rise animation (delay via `style`).
	// `href` is a typed app pathname (e.g. "/login"); it's `resolve()`d here so callers pass a
	// plain, route-checked path and the anchor honors SvelteKit's base-path handling.
	type Props = { text?: string; linkText: string; href: Pathname; holo?: boolean; style?: string };
	let { text, linkText, href, holo = false, style }: Props = $props();
</script>

<p class={["auth-sys-label text-center", holo && "auth-holo"]} {style}>
	{#if text}{text}
	{/if}<a href={resolve(href)} class="text-foreground transition-colors hover:text-primary"
		>{linkText}</a
	>
</p>
