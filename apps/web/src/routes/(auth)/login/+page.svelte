<script lang="ts">
	import { goto } from "$app/navigation";
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
	let password = $state("");
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		loading = true;

		const result = await authClient.signIn.email({ email, password });

		loading = false;

		if (result.error) {
			const code = result.error.code;
			if (code === "EMAIL_NOT_VERIFIED") {
				error = t("auth.emailNotVerified");
			} else {
				error = t("auth.invalidCredentials");
			}
		} else {
			goto(resolve("/"));
		}
	}
</script>

<svelte:head>
	<title>{t("auth.loginTitle")} — {t("common.appName")}</title>
</svelte:head>

<Card>
	<CardHeader>
		<CardTitle>{t("auth.loginTitle")}</CardTitle>
		<CardDescription>{t("auth.loginDescription")}</CardDescription>
	</CardHeader>
	<CardContent>
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

			<div class="flex flex-col gap-2">
				<Label for="password">{t("auth.password")}</Label>
				<Input
					id="password"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
				/>
			</div>

			<div class="flex justify-end">
				<a
					href={resolve("/forgot-password")}
					class="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
				>
					{t("auth.forgotPassword")}
				</a>
			</div>

			<Button type="submit" disabled={loading} class="w-full">
				{loading ? t("common.loading") : t("auth.login")}
			</Button>

			<p class="text-center text-sm text-muted-foreground">
				{t("auth.noAccount")}
				<a
					href={resolve("/register")}
					class="text-foreground underline underline-offset-4 hover:text-primary"
				>
					{t("auth.register")}
				</a>
			</p>
		</form>
	</CardContent>
</Card>
