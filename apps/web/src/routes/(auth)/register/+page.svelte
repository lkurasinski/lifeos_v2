<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { z } from "zod";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Field } from "$lib/components/ui/field";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { AuthHeader, AuthFooterLink } from "$lib/components/auth";

	const registerSchema = z
		.object({
			name: z.string().min(1),
			email: z.string().email(),
			password: z.string().min(8, t("auth.passwordTooShort")),
			confirmPassword: z.string(),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: t("auth.passwordMismatch"),
			path: ["confirmPassword"],
		});

	let name = $state("");
	let email = $state("");
	let password = $state("");
	let confirmPassword = $state("");
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;

		const validation = registerSchema.safeParse({ name, email, password, confirmPassword });
		if (!validation.success) {
			error = validation.error.issues[0].message;
			return;
		}

		loading = true;

		const result = await authClient.signUp.email({
			email,
			password,
			name,
			callbackURL: resolve("/login"),
		});

		loading = false;

		if (result.error) {
			const code = result.error.code;
			if (code === "USER_ALREADY_EXISTS") {
				error = t("auth.emailInUse");
			} else {
				error = t("auth.genericError");
			}
			return;
		}

		goto(resolve("/verify-email"));
	}
</script>

<svelte:head>
	<title>{t("auth.registerTitle")} — {t("common.appName")}</title>
</svelte:head>

<div>
	<AuthHeader holo style="--hd: 0ms" label={t("auth.register")} title={t("auth.registerTitle")} />

	<form onsubmit={handleSubmit} class="flex flex-col gap-5">
		{#if error}
			<div class="auth-holo" style="--hd: 80ms">
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			</div>
		{/if}

		<Field class="auth-holo" style="--hd: 160ms" label={t("auth.name")} for="name">
			<div class="auth-field">
				<Input
					id="name"
					type="text"
					bind:value={name}
					required
					autocomplete="name"
					placeholder="Jan"
				/>
			</div>
		</Field>

		<Field class="auth-holo" style="--hd: 250ms" label={t("auth.email")} for="email">
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

		<Field class="auth-holo" style="--hd: 340ms" label={t("auth.password")} for="password">
			<div class="auth-field">
				<Input
					id="password"
					type="password"
					bind:value={password}
					required
					autocomplete="new-password"
				/>
			</div>
		</Field>

		<Field
			class="auth-holo"
			style="--hd: 430ms"
			label={t("auth.confirmPassword")}
			for="confirm-password"
		>
			<div class="auth-field">
				<Input
					id="confirm-password"
					type="password"
					bind:value={confirmPassword}
					required
					autocomplete="new-password"
				/>
			</div>
		</Field>

		<div class="auth-holo" style="--hd: 520ms">
			<Button size="lg" type="submit" disabled={loading} class="mt-1 w-full">
				{loading ? t("common.loading") : t("auth.register")}
			</Button>
		</div>

		<AuthFooterLink
			holo
			style="--hd: 600ms"
			text={t("auth.hasAccount")}
			linkText={t("auth.login")}
			href="/login"
		/>
	</form>
</div>
