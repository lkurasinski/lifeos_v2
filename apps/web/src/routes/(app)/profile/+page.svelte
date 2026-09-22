<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { IconButton } from "$lib/components/ui/icon-button";
	import NutritionalTargetsForm from "$lib/components/profile/NutritionalTargetsForm.svelte";
	import { t } from "$lib/i18n";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	function back() {
		goto(resolve("/"));
	}
</script>

<svelte:head>
	<title>{t("nutritionTargets.title")} — {t("common.appName")}</title>
</svelte:head>

<div class="min-h-svh">
	<header class="appbar flex items-center gap-4 px-7 py-4 max-md:px-[18px] max-md:py-3">
		<IconButton onclick={back} aria-label={t("nutritionTargets.back")}>
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M12.7 4.3a1 1 0 0 1 0 1.4L8.42 10l4.3 4.3a1 1 0 1 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z"
					clip-rule="evenodd"
				/>
			</svg>
		</IconButton>
		<div>
			<div class="text-[0.6875rem] font-medium tracking-[0.04em] text-muted-foreground">
				{t("nutritionTargets.crumb")}
			</div>
			<h1 class="mt-px text-xl font-semibold tracking-[-0.015em] text-foreground">
				{t("nutritionTargets.title")}
			</h1>
		</div>
	</header>

	<div class="mx-auto max-w-[640px] px-7 pb-14 pt-[26px] max-md:px-[18px]">
		<NutritionalTargetsForm targets={data.targets} />
	</div>
</div>
