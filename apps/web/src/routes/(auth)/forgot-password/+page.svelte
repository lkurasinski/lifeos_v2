<script lang="ts">
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Field } from "$lib/components/ui/field";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { AuthHeader, AuthFooterLink } from "$lib/components/auth";

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
	<AuthHeader
		holo
		style="--hd: 0ms"
		label={t("auth.resetPasswordTitle")}
		title={t("auth.resetPasswordTitle")}
	/>

	{#if submitted}
		<div class="flex flex-col gap-5">
			<div class="auth-holo" style="--hd: 80ms">
				<Alert>
					<AlertDescription>{t("auth.resetLinkSent")}</AlertDescription>
				</Alert>
			</div>
			<AuthFooterLink
				holo
				style="--hd: 180ms"
				text=""
				linkText={t("auth.backToLogin")}
				href={resolve("/login")}
			/>
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

			<div class="auth-holo" style="--hd: 260ms">
				<Button size="lg" type="submit" disabled={loading} class="w-full">
					{loading ? t("common.loading") : t("auth.sendResetLink")}
				</Button>
			</div>

			<AuthFooterLink
				holo
				style="--hd: 340ms"
				text=""
				linkText={t("auth.backToLogin")}
				href={resolve("/login")}
			/>
		</form>
	{/if}
</div>
