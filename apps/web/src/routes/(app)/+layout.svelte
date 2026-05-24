<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { Button } from "$lib/components/ui/button";

	let { data, children } = $props();

	async function handleLogout() {
		await authClient.signOut();
		goto(resolve("/login"));
	}
</script>

<div class="flex min-h-screen flex-col">
	<header class="border-b">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
			<span class="font-semibold">{t("common.appName")}</span>
			<div class="flex items-center gap-3">
				<span class="text-sm text-muted-foreground">{data.user?.name}</span>
				<Button variant="outline" size="sm" onclick={handleLogout}>
					{t("auth.logout")}
				</Button>
			</div>
		</div>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
		{@render children()}
	</main>
</div>
