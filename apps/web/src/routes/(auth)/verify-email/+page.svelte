<script lang="ts">
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
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

<div>
	<header>
		<p class="auth-sys-label">{t("auth.verifyEmailTitle")}</p>
		<h1 class="auth-page-title">{t("auth.verifyEmailTitle")}</h1>
	</header>

	<form onsubmit={resendEmail} class="flex flex-col gap-5">
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

		<p class="text-[0.9375rem] leading-[1.6] text-muted-foreground">
			{t("auth.verifyEmailDescription")}
		</p>

		<div class="flex flex-col gap-1.5">
			<Label for="email">{t("auth.email")}</Label>
			<div class="auth-field">
				<Input
					id="email"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					placeholder="ty@przyklad.pl"
				/>
			</div>
		</div>

		<Button size="lg" type="submit" disabled={loading} class="mt-2 w-full">
			{loading ? t("common.loading") : t("auth.resendVerification")}
		</Button>

		<p class="auth-sys-label text-center">
			{t("auth.hasAccount")}
			<a href={resolve("/login")} class="text-foreground transition-colors hover:text-primary">
				{t("auth.login")}
			</a>
		</p>
	</form>
</div>
