<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	// The varied tinted field behind glass: soft radial hue zones so the frost
	// has color to refract and never reads as a flat card. Purely presentational
	// background layer (see .env in layout.css for the light/dark zone sets).
	type Props = HTMLAttributes<HTMLDivElement> & { class?: string };

	let { class: className, ...restProps }: Props = $props();
</script>

<div aria-hidden="true" class={cn("env pointer-events-none fixed inset-0 -z-10", className)} {...restProps}></div>
