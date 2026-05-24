<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { z } from "zod";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";

	const registerSchema = z
		.object({
			email: z.string().email(),
			password: z.string().min(8, t("auth.passwordTooShort")),
			confirmPassword: z.string(),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: t("auth.passwordMismatch"),
			path: ["confirmPassword"],
		});

	let email = $state("");
	let password = $state("");
	let confirmPassword = $state("");
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;

		const validation = registerSchema.safeParse({ email, password, confirmPassword });
		if (!validation.success) {
			error = validation.error.issues[0].message;
			return;
		}

		loading = true;

		const result = await authClient.signUp.email({ email, password, name: email });

		if (result.error) {
			loading = false;
			const code = result.error.code;
			if (code === "USER_ALREADY_EXISTS") {
				error = t("auth.emailInUse");
			} else {
				error = t("auth.genericError");
			}
			return;
		}

		const signInResult = await authClient.signIn.email({ email, password });
		loading = false;

		if (signInResult.error) {
			error = t("auth.genericError");
		} else {
			goto(resolve("/"));
		}
	}
</script>

<svelte:head>
	<title>{t("auth.registerTitle")} — {t("common.appName")}</title>
</svelte:head>

<Card>
	<CardHeader>
		<CardTitle>{t("auth.registerTitle")}</CardTitle>
		<CardDescription>{t("auth.registerDescription")}</CardDescription>
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
					autocomplete="new-password"
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="confirm-password">{t("auth.confirmPassword")}</Label>
				<Input
					id="confirm-password"
					type="password"
					bind:value={confirmPassword}
					required
					autocomplete="new-password"
				/>
			</div>

			<Button type="submit" disabled={loading} class="w-full">
				{loading ? t("common.loading") : t("auth.register")}
			</Button>

			<p class="text-center text-sm text-muted-foreground">
				{t("auth.hasAccount")}
				<a href={resolve("/login")} class="text-foreground underline underline-offset-4 hover:text-primary">
					{t("auth.login")}
				</a>
			</p>
		</form>
	</CardContent>
</Card>
