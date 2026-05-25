<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
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

<div>
	<header class="auth-holo" style="--hd: 0ms">
		<p class="auth-sys-label">{t("auth.login")}</p>
		<h1 class="auth-page-title">{t("auth.loginTitle")}</h1>
	</header>

	<form onsubmit={handleSubmit} class="flex flex-col gap-5">
		{#if error}
			<div class="auth-holo" style="--hd: 80ms">
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			</div>
		{/if}

		<div class="auth-holo flex flex-col gap-1.5" style="--hd: 160ms">
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

		<div class="auth-holo flex flex-col gap-1.5" style="--hd: 260ms">
			<div class="flex items-center justify-between">
				<Label for="password">{t("auth.password")}</Label>
				<a
					href={resolve("/forgot-password")}
					class="auth-sys-label transition-colors hover:text-foreground"
					style="opacity: 0.5;"
				>
					{t("auth.forgotPassword")}
				</a>
			</div>
			<div class="auth-field">
				<Input
					id="password"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
				/>
			</div>
		</div>

		<div class="auth-holo" style="--hd: 360ms">
			<Button size="lg" type="submit" disabled={loading} class="mt-1 w-full">
				{loading ? t("common.loading") : t("auth.login")}
			</Button>
		</div>

		<p class="auth-holo auth-sys-label text-center" style="--hd: 440ms">
			{t("auth.noAccount")}
			<a href={resolve("/register")} class="text-foreground transition-colors hover:text-primary">
				{t("auth.register")}
			</a>
		</p>
	</form>
</div>
