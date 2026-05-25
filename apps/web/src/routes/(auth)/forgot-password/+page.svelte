<script lang="ts">
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
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

<div>
	<header class="auth-holo" style="--hd: 0ms">
		<p class="auth-sys-label">{t("auth.resetPasswordTitle")}</p>
		<h1 class="auth-page-title">{t("auth.resetPasswordTitle")}</h1>
	</header>

	{#if submitted}
		<div class="flex flex-col gap-5">
			<div class="auth-holo" style="--hd: 80ms">
				<Alert>
					<AlertDescription>{t("auth.resetLinkSent")}</AlertDescription>
				</Alert>
			</div>
			<p class="auth-holo auth-sys-label text-center" style="--hd: 180ms">
				<a href={resolve("/login")} class="text-foreground transition-colors hover:text-primary">
					{t("auth.backToLogin")}
				</a>
			</p>
		</div>
	{:else}
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

			<div class="auth-holo" style="--hd: 260ms">
				<Button size="lg" type="submit" disabled={loading} class="w-full">
					{loading ? t("common.loading") : t("auth.sendResetLink")}
				</Button>
			</div>

			<p class="auth-holo auth-sys-label text-center" style="--hd: 340ms">
				<a href={resolve("/login")} class="text-foreground transition-colors hover:text-primary">
					{t("auth.backToLogin")}
				</a>
			</p>
		</form>
	{/if}
</div>
