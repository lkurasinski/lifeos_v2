<script lang="ts">
	import { t } from "$lib/i18n";

	// Placeholder catalog entry point — the full master–detail browse/detail UI is
	// built in Phase 4. This stub gives the rail's "Produkty" item a real route so
	// navigation and active state work from the app shell.
</script>

<svelte:head>
	<title>{t("nav.products")} — {t("common.appName")}</title>
</svelte:head>

<div class="placeholder">
	<h1>{t("nav.products")}</h1>
</div>

<style>
	.placeholder {
		padding: 24px;
	}
	.placeholder h1 {
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.015em;
	}
</style>
