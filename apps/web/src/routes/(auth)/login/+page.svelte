<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Field } from "$lib/components/ui/field";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { AuthHeader, AuthFooterLink } from "$lib/components/auth";

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

<div>
	<AuthHeader holo style="--hd: 0ms" label={t("auth.login")} title={t("auth.loginTitle")} />

	<form onsubmit={handleSubmit} class="flex flex-col gap-5">
		{#if error}
			<div class="auth-holo" style="--hd: 80ms">
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			</div>
		{/if}

		<Field class="auth-holo" style="--hd: 160ms" label={t("auth.email")} for="email">
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
		</Field>

		<Field class="auth-holo" style="--hd: 260ms" label={t("auth.password")} for="password">
			{#snippet labelAction()}
				<a
					href={resolve("/forgot-password")}
					class="auth-sys-label transition-colors hover:text-primary"
				>
					{t("auth.forgotPassword")}
				</a>
			{/snippet}
			<div class="auth-field">
				<Input
					id="password"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
				/>
			</div>
		</Field>

		<div class="auth-holo" style="--hd: 360ms">
			<Button size="lg" type="submit" disabled={loading} class="mt-1 w-full">
				{loading ? t("common.loading") : t("auth.login")}
			</Button>
		</div>

		<AuthFooterLink
			holo
			style="--hd: 440ms"
			text={t("auth.noAccount")}
			linkText={t("auth.register")}
			href={resolve("/register")}
		/>
	</form>
</div>
