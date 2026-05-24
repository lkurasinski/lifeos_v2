<script lang="ts">
	import { t } from "$lib/i18n";

	let { data } = $props();
</script>

<svelte:head>
	<title>{t("dashboard.title")} — {t("common.appName")}</title>
</svelte:head>

<h1 class="text-2xl font-bold">
	{t("dashboard.welcome")}, {data.user?.name}!
</h1>
