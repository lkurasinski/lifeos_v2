<script lang="ts">
	import ParticleField from '$lib/components/particle-field.svelte';
	let { children } = $props();
</script>

<div class="auth-grid">
	<!-- Brand panel -->
	<aside class="auth-brand overflow-hidden">
		<!-- Orbital rings -->
		<div class="auth-brand-ring auth-brand-ring-1" aria-hidden="true"></div>
		<div class="auth-brand-ring auth-brand-ring-2" aria-hidden="true"></div>
		<div class="auth-brand-ring auth-brand-ring-3" aria-hidden="true"></div>

		<!-- Vertical data streams -->
		<div class="auth-stream-field" aria-hidden="true">
			<span class="auth-stream" style="left: 11%; --dur: 17s; --delay: 0s">ATGCATGCTAGCTAGC·0xFF1A2B·NEURAL·01001101·BIOMECH·ATCG</span>
			<span class="auth-stream" style="left: 46%; --dur: 24s; --delay: -10s">CGTATGCG·0x3C4D·HELIX·110101·SYSINIT·0xCAFE·ATGCATGC</span>
			<span class="auth-stream" style="left: 81%; --dur: 19s; --delay: -15s">0110101·BIND·0x2B·MOLBIO·01110101·CGCGATCG·NEURAL·HX</span>
		</div>

		<div class="auth-brand-inner relative z-10">
			<div class="auth-brand-main">
				<p class="auth-sys-label hidden lg:block">SYSTEM ŻYWIENIA — AI</p>
				<p class="auth-wordmark">LifeOS</p>
				<p class="auth-tagline hidden lg:block">
					Katalog przepisów → plan tygodniowy → lista zakupów. AI proponuje, ty&nbsp;decydujesz.
				</p>
			</div>
			<div class="hidden lg:block">
				<span class="auth-sys-label" style="opacity: 0.4;">v1.0 — BETA</span>
			</div>
		</div>
	</aside>

	<!-- Form area -->
	<main class="auth-form-area">
		<ParticleField />
		<div class="auth-form-inner">
			{@render children()}
		</div>
	</main>
</div>
