<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { authClient } from "$lib/auth-client";
	import { Env } from "$lib/components/ui/env";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { t } from "$lib/i18n";

	let { data, children } = $props();

	// Produkty is the only wired route; everything else in the rail is a disabled
	// placeholder until its slice lands (S-02+).
	let productsActive = $derived(page.url.pathname.startsWith("/foods"));

	function initials(name?: string | null): string {
		if (!name) return "?";
		return (
			name
				.trim()
				.split(/\s+/)
				.slice(0, 2)
				.map((part) => part[0]?.toUpperCase() ?? "")
				.join("") || "?"
		);
	}

	async function handleLogout() {
		// Always navigate away, even if signOut rejects (network/server error),
		// so a failed sign-out never strands the user on an authenticated screen.
		try {
			await authClient.signOut();
		} finally {
			goto(resolve("/login"));
		}
	}
</script>

<Env />

<div class="shell">
	<nav class="rail" aria-label={t("nav.section")}>
		<div class="brandmark">
			<span class="mk">
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
					><path
						d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm0 2.7a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Z"
						opacity=".5"
					/><circle cx="10" cy="10" r="2.6" /></svg
				>
			</span>
			<span class="wm">{t("common.appName")}<span>{t("nav.brandSub")}</span></span>
		</div>

		<div class="navlab">{t("nav.section")}</div>
		<div class="navlist">
			<a
				class="navitem"
				class:active={productsActive}
				href={resolve("/foods")}
				aria-current={productsActive ? "page" : undefined}
			>
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
					><path
						d="M10 1.8 3 5.4v9.2l7 3.6 7-3.6V5.4L10 1.8Zm0 2.1 4.6 2.4L10 8.7 5.4 6.3 10 3.9ZM4.5 7.6l4.7 2.4v6.1L4.5 13.7V7.6Zm6.3 8.5V10l4.7-2.4v6.1L10.8 16.1Z"
					/></svg
				>
				{t("nav.products")}
			</a>
			<button class="navitem" type="button" disabled>
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
					><path d="M4 3.6A1.6 1.6 0 0 1 5.6 2H10v15.4l-.9-.5a3 3 0 0 0-1.5-.4H5.6A1.6 1.6 0 0 1 4 14.9V3.6Z" /><path
						d="M16 3.6A1.6 1.6 0 0 0 14.4 2H10v15.4l.9-.5a3 3 0 0 1 1.5-.4h2A1.6 1.6 0 0 0 16 14.9V3.6Z"
						opacity=".5"
					/></svg
				>
				{t("nav.recipes")}
			</button>
			<button class="navitem" type="button" disabled>
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
					><path
						fill-rule="evenodd"
						d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
						clip-rule="evenodd"
					/></svg
				>
				{t("nav.weeklyPlan")}
			</button>
			<button class="navitem" type="button" disabled>
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
					><path
						d="M2 3.5a.75.75 0 0 1 .75-.75h1.32c.64 0 1.18.45 1.31 1.07l.13.68h11.04c.5 0 .86.47.73.96l-1.45 5.4a1.5 1.5 0 0 1-1.45 1.11H7.2a1.5 1.5 0 0 1-1.47-1.18L4.2 4.4l-.04-.15H2.75A.75.75 0 0 1 2 3.5Z"
					/><circle cx="7.6" cy="16" r="1.45" /><circle cx="14.4" cy="16" r="1.45" /></svg
				>
				{t("nav.shoppingList")}
			</button>
		</div>

		<div class="railfoot">
			<div class="user">
				<span class="av">{initials(data.user?.name)}</span>
				<span class="uinfo">
					<span class="un">{data.user?.name}</span>
					<span class="ue">{data.user?.email}</span>
				</span>
				<div class="uactions">
					<IconButton size="sm" disabled aria-label={t("nav.settings")}>
						<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
							><path
								fill-rule="evenodd"
								d="M8.34 2.6a1.5 1.5 0 0 1 3.32 0l.13.74a1.5 1.5 0 0 0 2.06 1.19l.7-.29a1.5 1.5 0 0 1 1.66 2.88l-.57.49a1.5 1.5 0 0 0 0 2.38l.57.49a1.5 1.5 0 0 1-1.66 2.88l-.7-.29a1.5 1.5 0 0 0-2.06 1.19l-.13.74a1.5 1.5 0 0 1-3.32 0l-.13-.74a1.5 1.5 0 0 0-2.06-1.19l-.7.29a1.5 1.5 0 0 1-1.66-2.88l.57-.49a1.5 1.5 0 0 0 0-2.38l-.57-.49a1.5 1.5 0 0 1 1.66-2.88l.7.29A1.5 1.5 0 0 0 8.2 3.34l.14-.74ZM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
								clip-rule="evenodd"
							/></svg
						>
					</IconButton>
					<IconButton size="sm" onclick={handleLogout} aria-label={t("auth.logout")}>
						<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
							><path
								fill-rule="evenodd"
								d="M3 4.75A1.75 1.75 0 0 1 4.75 3h4.5a.75.75 0 0 1 0 1.5h-4.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h4.5a.75.75 0 0 1 0 1.5h-4.5A1.75 1.75 0 0 1 3 15.25V4.75Z"
								clip-rule="evenodd"
							/><path
								d="M12.97 6.47a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H8.25a.75.75 0 0 1 0-1.5h6.44l-1.72-1.72a.75.75 0 0 1 0-1.06Z"
							/></svg
						>
					</IconButton>
				</div>
			</div>
		</div>
	</nav>

	<main class="main">
		{@render children()}
	</main>
</div>

<style>
	/* Glass app shell: a persistent left nav rail refracting the tinted .env field,
	   with page content (which owns its own topbar) rendered in <main>. Tokens come
	   from the global :root contract in layout.css; no new color tokens introduced. */
	.shell {
		position: relative;
		z-index: 0;
		display: flex;
		min-height: 100svh;
	}

	.rail {
		position: sticky;
		top: 0;
		z-index: 1;
		flex-shrink: 0;
		width: 200px;
		height: 100svh;
		display: flex;
		flex-direction: column;
		padding: 20px 13px;
		border-right: 1px solid var(--hairline);
		background: var(--glass-fill);
		backdrop-filter: blur(var(--blur)) saturate(var(--sat));
		-webkit-backdrop-filter: blur(var(--blur)) saturate(var(--sat));
	}

	.brandmark {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px 20px;
	}
	.brandmark .mk {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-sm, 0.625rem);
		background: var(--primary);
		color: var(--primary-foreground);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.brandmark .mk svg {
		width: 20px;
		height: 20px;
	}
	.brandmark .wm {
		font-size: 1.0625rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.brandmark .wm span {
		display: block;
		font-size: 0.5625rem;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-top: 1px;
	}

	.navlab {
		font-size: 0.5625rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		padding: 6px 11px 8px;
	}
	.navlist {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.navitem {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 10px 11px;
		border-radius: var(--radius-sm, 0.625rem);
		border: 0;
		width: 100%;
		text-align: left;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		letter-spacing: -0.005em;
		cursor: pointer;
		color: var(--muted-foreground);
		background: transparent;
		text-decoration: none;
		transition: background-color 180ms var(--ease), color 180ms var(--ease);
	}
	.navitem svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.navitem:hover:not(:disabled) {
		background: var(--accent);
		color: var(--foreground);
	}
	.navitem.active {
		background: var(--card);
		color: var(--foreground);
		font-weight: 600;
		box-shadow: var(--shadow-soft);
	}
	.navitem:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.railfoot {
		margin-top: auto;
		padding-top: 14px;
		border-top: 1px solid var(--hairline);
	}
	.user {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		border-radius: var(--radius-sm, 0.625rem);
	}
	.user .av {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--secondary);
		color: var(--foreground);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
		box-shadow: inset 0 0 0 1px var(--hairline);
	}
	.user .uinfo {
		min-width: 0;
		flex: 1;
	}
	.user .un {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.user .ue {
		display: block;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.uactions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.main {
		position: relative;
		z-index: 0;
		flex: 1;
		min-width: 0;
	}

	/* Mobile-first one-hand use: the rail becomes a thumb-reachable bottom bar.
	   Brandmark, section label, and user text collapse; nav + logout stay. */
	@media (max-width: 768px) {
		.rail {
			position: fixed;
			inset: auto 0 0 0;
			width: 100%;
			height: auto;
			flex-direction: row;
			align-items: center;
			gap: 4px;
			padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
			border-right: 0;
			border-top: 1px solid var(--hairline);
			z-index: 20;
		}
		.brandmark,
		.navlab,
		.user .uinfo {
			display: none;
		}
		.navlist {
			flex-direction: row;
			flex: 1;
			justify-content: space-around;
			gap: 2px;
		}
		.navitem {
			flex-direction: column;
			gap: 3px;
			padding: 6px 8px;
			min-width: 56px;
			min-height: 44px;
			justify-content: center;
			font-size: 0.625rem;
			text-align: center;
		}
		.navitem.active {
			box-shadow: none;
		}
		.railfoot {
			margin-top: 0;
			padding-top: 0;
			border-top: 0;
		}
		.user {
			padding: 0;
		}
		.user .av {
			display: none;
		}
		.main {
			padding-bottom: 68px;
		}
	}

	/* Reduced motion: glass degrades to a solid tint and transitions resolve instantly. */
	@media (prefers-reduced-motion: reduce) {
		.rail {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--card);
		}
		.navitem {
			transition: none;
		}
	}

	/* Where backdrop-filter is unsupported, the rail resolves to a solid card surface. */
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.rail {
			background: var(--card);
		}
	}
</style>
