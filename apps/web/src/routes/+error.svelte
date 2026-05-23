<script lang="ts">
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import { t } from "$lib/i18n";
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="text-center">
		<h1 class="text-4xl font-bold text-foreground">{page.status}</h1>
		<p class="mt-2 text-muted-foreground">
			{page.status === 404 ? t("common.notFound") : t("common.error")}
		</p>
		<a href={resolve("/")} class="mt-4 inline-block text-primary underline">
			{t("common.back")}
		</a>
	</div>
</div>
