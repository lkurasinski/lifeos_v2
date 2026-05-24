<script lang="ts">
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";

	let email = $state("");
	let submitted = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		loading = true;

		const result = await authClient.requestPasswordReset({
			email,
			redirectTo: resolve("/reset-password"),
		});

		loading = false;

		if (result.error) {
			error = t("auth.genericError");
		} else {
			submitted = true;
		}
	}
</script>

<svelte:head>
	<title>{t("auth.resetPasswordTitle")} — {t("common.appName")}</title>
</svelte:head>

<Card>
	<CardHeader>
		<CardTitle>{t("auth.resetPasswordTitle")}</CardTitle>
		<CardDescription>{t("auth.resetPasswordDescription")}</CardDescription>
	</CardHeader>
	<CardContent>
		{#if submitted}
			<div class="flex flex-col gap-4">
				<Alert>
					<AlertDescription>{t("auth.resetLinkSent")}</AlertDescription>
				</Alert>
				<p class="text-center text-sm text-muted-foreground">
					<a
						href={resolve("/login")}
						class="text-foreground underline underline-offset-4 hover:text-primary"
					>
						{t("auth.backToLogin")}
					</a>
				</p>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="flex flex-col gap-4">
				{#if error}
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				{/if}

				<div class="flex flex-col gap-2">
					<Label for="email">{t("auth.email")}</Label>
					<Input
						id="email"
						type="email"
						bind:value={email}
						required
						autocomplete="email"
						placeholder="ty@przyklad.pl"
					/>
				</div>

				<Button type="submit" disabled={loading} class="w-full">
					{loading ? t("common.loading") : t("auth.sendResetLink")}
				</Button>

				<p class="text-center text-sm text-muted-foreground">
					<a
						href={resolve("/login")}
						class="text-foreground underline underline-offset-4 hover:text-primary"
					>
						{t("auth.backToLogin")}
					</a>
				</p>
			</form>
		{/if}
	</CardContent>
</Card>
