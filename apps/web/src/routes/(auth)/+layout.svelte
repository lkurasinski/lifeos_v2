<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</div>
