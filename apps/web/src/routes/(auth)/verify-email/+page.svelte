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
	let sent = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function resendEmail(e: SubmitEvent) {
		e.preventDefault();
		if (!email) return;
		loading = true;
		error = null;
		sent = false;

		const result = await authClient.sendVerificationEmail({
			email,
			callbackURL: resolve("/login"),
		});

		loading = false;

		if (result.error) {
			error = t("auth.genericError");
		} else {
			sent = true;
		}
	}
</script>

<svelte:head>
	<title>{t("auth.verifyEmailTitle")} — {t("common.appName")}</title>
</svelte:head>

<Card>
	<CardHeader>
		<CardTitle>{t("auth.verifyEmailTitle")}</CardTitle>
		<CardDescription>{t("auth.verifyEmailDescription")}</CardDescription>
	</CardHeader>
	<CardContent>
		<form onsubmit={resendEmail} class="flex flex-col gap-4">
			{#if error}
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			{/if}

			{#if sent}
				<Alert>
					<AlertDescription>{t("auth.verificationSent")}</AlertDescription>
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
				{loading ? t("common.loading") : t("auth.resendVerification")}
			</Button>

			<p class="text-center text-sm text-muted-foreground">
				{t("auth.alreadyHaveAccount")}
				{" "}
				<a
					href={resolve("/login")}
					class="text-foreground underline underline-offset-4 hover:text-primary"
				>
					{t("auth.login")}
				</a>
			</p>
		</form>
	</CardContent>
</Card>
