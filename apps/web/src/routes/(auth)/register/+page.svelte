<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { authClient } from "$lib/auth-client";
	import { t } from "$lib/i18n";
	import { z } from "zod";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";

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
	<header class="auth-holo" style="--hd: 0ms">
		<p class="auth-sys-label">{t("auth.register")}</p>
		<h1 class="auth-page-title">{t("auth.registerTitle")}</h1>
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
			<Label for="name">{t("auth.name")}</Label>
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
		</div>

		<div class="auth-holo flex flex-col gap-1.5" style="--hd: 250ms">
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

		<div class="auth-holo flex flex-col gap-1.5" style="--hd: 340ms">
			<Label for="password">{t("auth.password")}</Label>
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

		<div class="auth-holo flex flex-col gap-1.5" style="--hd: 430ms">
			<Label for="confirm-password">{t("auth.confirmPassword")}</Label>
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

		<div class="auth-holo" style="--hd: 520ms">
			<Button size="lg" type="submit" disabled={loading} class="mt-1 w-full">
				{loading ? t("common.loading") : t("auth.register")}
			</Button>
		</div>

		<p class="auth-holo auth-sys-label text-center" style="--hd: 600ms">
			{t("auth.hasAccount")}
			<a href={resolve("/login")} class="text-foreground transition-colors hover:text-primary">
				{t("auth.login")}
			</a>
		</p>
	</form>
</div>
