<script lang="ts">
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { z } from "zod";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";

	const resetSchema = z
		.object({
			password: z.string().min(8, t("auth.passwordTooShort")),
			confirmPassword: z.string(),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: t("auth.passwordMismatch"),
			path: ["confirmPassword"],
		});

	let password = $state("");
	let confirmPassword = $state("");
	let error = $state<string | null>(null);
	let success = $state(false);
	let loading = $state(false);

	let token = $derived(page.url.searchParams.get("token"));
	let urlError = $derived(page.url.searchParams.get("error"));

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;

		const validation = resetSchema.safeParse({ password, confirmPassword });
		if (!validation.success) {
			error = validation.error.issues[0].message;
			return;
		}

		if (!token) {
			error = t("auth.invalidOrExpiredToken");
			return;
		}

		loading = true;

		const result = await authClient.resetPassword({
			newPassword: password,
			token,
		});

		loading = false;

		if (result.error) {
			error = t("auth.invalidOrExpiredToken");
		} else {
			success = true;
		}
	}
</script>

<svelte:head>
	<title>{t("auth.resetPassword")} — {t("common.appName")}</title>
</svelte:head>

<div>
	<header>
		<p class="auth-sys-label">{t("auth.resetPassword")}</p>
		<h1 class="auth-page-title">{t("auth.resetPasswordTitle")}</h1>
	</header>

	{#if success}
		<div class="flex flex-col gap-5">
			<Alert>
				<AlertDescription>{t("auth.resetPasswordSuccess")}</AlertDescription>
			</Alert>
			<p class="auth-sys-label text-center">
				<a href={resolve("/login")} class="text-foreground transition-colors hover:text-primary">
					{t("auth.backToLogin")}
				</a>
			</p>
		</div>
	{:else if urlError || !token}
		<div class="flex flex-col gap-5">
			<Alert variant="destructive">
				<AlertDescription>{t("auth.invalidOrExpiredToken")}</AlertDescription>
			</Alert>
			<p class="auth-sys-label text-center">
				<a href={resolve("/forgot-password")} class="text-foreground transition-colors hover:text-primary">
					{t("auth.forgotPassword")}
				</a>
			</p>
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="flex flex-col gap-5">
			{#if error}
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			{/if}

			<div class="flex flex-col gap-1.5">
				<Label for="password">{t("auth.newPassword")}</Label>
				<div class="auth-field">
					<Input
						id="password"
						type="password"
						bind:value={password}
						required
						autocomplete="new-password"
					/>
				</div>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="confirm-password">{t("auth.confirmNewPassword")}</Label>
				<div class="auth-field">
					<Input
						id="confirm-password"
						type="password"
						bind:value={confirmPassword}
						required
						autocomplete="new-password"
					/>
				</div>
			</div>

			<Button size="lg" type="submit" disabled={loading} class="mt-2 w-full">
				{loading ? t("common.loading") : t("auth.resetPassword")}
			</Button>

			<p class="auth-sys-label text-center">
				<a href={resolve("/login")} class="text-foreground transition-colors hover:text-primary">
					{t("auth.backToLogin")}
				</a>
			</p>
		</form>
	{/if}
</div>
