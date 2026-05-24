<script lang="ts">
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { z } from "zod";
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

<Card>
	<CardHeader>
		<CardTitle>{t("auth.resetPassword")}</CardTitle>
		{#if !success && !urlError && token}
			<CardDescription>{t("auth.resetPasswordDescription")}</CardDescription>
		{/if}
	</CardHeader>
	<CardContent>
		{#if success}
			<div class="flex flex-col gap-4">
				<Alert>
					<AlertDescription>{t("auth.resetPasswordSuccess")}</AlertDescription>
				</Alert>
				<a
					href={resolve("/login")}
					class="text-center text-sm text-foreground underline underline-offset-4 hover:text-primary"
				>
					{t("auth.backToLogin")}
				</a>
			</div>
		{:else if urlError || !token}
			<div class="flex flex-col gap-4">
				<Alert variant="destructive">
					<AlertDescription>{t("auth.invalidOrExpiredToken")}</AlertDescription>
				</Alert>
				<a
					href={resolve("/forgot-password")}
					class="text-center text-sm text-foreground underline underline-offset-4 hover:text-primary"
				>
					{t("auth.forgotPassword")}
				</a>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="flex flex-col gap-4">
				{#if error}
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				{/if}

				<div class="flex flex-col gap-2">
					<Label for="password">{t("auth.newPassword")}</Label>
					<Input
						id="password"
						type="password"
						bind:value={password}
						required
						autocomplete="new-password"
					/>
				</div>

				<div class="flex flex-col gap-2">
					<Label for="confirm-password">{t("auth.confirmNewPassword")}</Label>
					<Input
						id="confirm-password"
						type="password"
						bind:value={confirmPassword}
						required
						autocomplete="new-password"
					/>
				</div>

				<Button type="submit" disabled={loading} class="w-full">
					{loading ? t("common.loading") : t("auth.resetPassword")}
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
