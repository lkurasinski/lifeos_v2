<script lang="ts">
	// The auth-page heading: a small system label over the page title. Shared by every
	// (auth) screen. `holo` opts the header into the staggered rise animation (set the
	// delay via `style="--hd: …"`).
	type Props = { label: string; title: string; holo?: boolean; style?: string };
	let { label, title, holo = false, style }: Props = $props();
</script>

<header class={holo ? "auth-holo" : undefined} {style}>
	<p class="auth-sys-label">{label}</p>
	<h1 class="auth-page-title">{title}</h1>
</header>
