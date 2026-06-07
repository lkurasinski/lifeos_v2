<script lang="ts">
	import { Toaster as Sonner, type ToasterProps } from "svelte-sonner";

	// Lean Sonner wrapper themed to the spatial-glass kit — no mode-watcher / lucide.
	// Surface + text + border are driven from our design tokens via the CSS vars Sonner
	// reads, so the toast follows light/dark automatically (the tokens already adapt).
	let { ...restProps }: ToasterProps = $props();
</script>

<Sonner
	class="lifeos-toaster"
	position="bottom-right"
	duration={4000}
	closeButton
	style="--normal-bg: var(--card); --normal-text: var(--foreground); --normal-border: var(--hairline); --border-radius: var(--radius);"
	{...restProps}
/>

<style>
	/* Sonner renders to a portal at the document root, so its toast nodes are reached
	   with :global. Match the kit: glass blur, lift shadow, inherited font. */
	:global(.lifeos-toaster) {
		font-family: inherit;
	}
	:global(.lifeos-toaster [data-sonner-toast]) {
		font-family: inherit;
		box-shadow: var(--shadow-lift);
		backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
		-webkit-backdrop-filter: blur(var(--blur-thick)) saturate(var(--sat));
	}
	:global(.lifeos-toaster [data-sonner-toast] [data-title]) {
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	:global(.lifeos-toaster [data-sonner-toast] [data-description]) {
		color: var(--muted-foreground);
	}
	/* Tint only the leading icon — color as a small signal, per the design system. */
	:global(.lifeos-toaster [data-sonner-toast][data-type="success"] [data-icon]) {
		color: var(--positive);
	}
	:global(.lifeos-toaster [data-sonner-toast][data-type="error"] [data-icon]) {
		color: var(--destructive);
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.lifeos-toaster [data-sonner-toast]) {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--card);
		}
	}
</style>
