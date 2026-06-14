<script lang="ts">
	// The centered account-switch line at the foot of an auth form (e.g. "No account?
	// Register"). `holo` opts into the staggered rise animation (delay via `style`).
	type Props = { text?: string; linkText: string; href: string; holo?: boolean; style?: string };
	let { text, linkText, href, holo = false, style }: Props = $props();
</script>

<p class={["auth-sys-label text-center", holo && "auth-holo"]} {style}>
	{#if text}{text} {/if}<a
		{href}
		class="text-foreground transition-colors hover:text-primary">{linkText}</a
	>
</p>
