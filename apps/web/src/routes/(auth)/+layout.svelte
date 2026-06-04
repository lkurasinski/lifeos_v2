<script lang="ts">
	import { t } from '$lib/i18n';
	let { children } = $props();
</script>

<div class="auth-grid">
	<!-- Brand panel -->
	<aside class="auth-brand">
		<div class="auth-brand-inner">
			<div class="auth-brand-main auth-holo">
				<p class="auth-sys-label auth-brand-eyebrow">{t('auth.brandLabel')}</p>
				<p class="auth-wordmark">Life<span>OS</span></p>
				<p class="auth-tagline">{t('auth.brandTagline')}</p>
			</div>

			<!-- Abstract data motif: macro-style bars, no literal nutrition data -->
			<div class="auth-motif auth-holo" style="--hd: 140ms" aria-hidden="true">
				<div class="auth-motif-head">
					<span class="auth-motif-legend">
						<i style="background: var(--primary)"></i>
						<i style="background: var(--positive)"></i>
						<i style="background: var(--caution)"></i>
					</span>
					<span class="auth-motif-fig">1&thinsp;900</span>
				</div>
				<div class="auth-motif-row">
					<span class="auth-motif-track">
						<i class="auth-motif-fill" style="--w: 72%; --d: 240ms"></i>
					</span>
					<span class="auth-motif-val">72</span>
				</div>
				<div class="auth-motif-row">
					<span class="auth-motif-track">
						<i class="auth-motif-fill" style="--w: 88%; --c: var(--positive); --d: 340ms"></i>
					</span>
					<span class="auth-motif-val">88</span>
				</div>
				<div class="auth-motif-row">
					<span class="auth-motif-track">
						<i class="auth-motif-fill" style="--w: 54%; --c: var(--caution); --d: 440ms"></i>
					</span>
					<span class="auth-motif-val">54</span>
				</div>
			</div>

			<p class="auth-sys-label auth-brand-status">{t('auth.brandStatus')}</p>
		</div>
	</aside>

	<!-- Form area -->
	<main class="auth-form-area">
		<div class="auth-form-inner">
			{@render children()}
		</div>
	</main>
</div>
