<script lang="ts">
	let canvas: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		if (!canvas) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		if (window.innerWidth < 1024) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		let w = 0, h = 0;
		let animId = 0;

		// Ice Core oklch(0.588 0.155 210) — canvas supports oklch in modern browsers
		const ICE = 'oklch(0.588 0.155 210)';
		const PARTICLE_N = 40;
		const CONNECT = 115;
		const SPEED = 0.22;

		interface P { x: number; y: number; vx: number; vy: number; r: number }
		let pts: P[] = [];

		function resize() {
			w = canvas!.offsetWidth;
			h = canvas!.offsetHeight;
			canvas!.width = Math.round(w * dpr);
			canvas!.height = Math.round(h * dpr);
			ctx!.scale(dpr, dpr);
			pts = Array.from({ length: PARTICLE_N }, () => ({
				x: Math.random() * w,
				y: Math.random() * h,
				vx: (Math.random() - 0.5) * SPEED,
				vy: (Math.random() - 0.5) * SPEED,
				r: 0.8 + Math.random() * 1.3,
			}));
		}

		function tick() {
			ctx!.clearRect(0, 0, w, h);

			// connections first (under particles)
			for (let i = 0; i < pts.length - 1; i++) {
				for (let j = i + 1; j < pts.length; j++) {
					const dx = pts[i].x - pts[j].x;
					const dy = pts[i].y - pts[j].y;
					const d = Math.sqrt(dx * dx + dy * dy);
					if (d < CONNECT) {
						ctx!.globalAlpha = (1 - d / CONNECT) * 0.14;
						ctx!.strokeStyle = ICE;
						ctx!.lineWidth = 0.5;
						ctx!.beginPath();
						ctx!.moveTo(pts[i].x, pts[i].y);
						ctx!.lineTo(pts[j].x, pts[j].y);
						ctx!.stroke();
					}
				}
			}

			ctx!.globalAlpha = 0.42;
			ctx!.fillStyle = ICE;
			for (const p of pts) {
				p.x += p.vx;
				p.y += p.vy;
				if (p.x < 0 || p.x > w) p.vx *= -1;
				if (p.y < 0 || p.y > h) p.vy *= -1;
				ctx!.beginPath();
				ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx!.fill();
			}
			ctx!.globalAlpha = 1;

			animId = requestAnimationFrame(tick);
		}

		resize();
		tick();

		const ro = new ResizeObserver(() => {
			cancelAnimationFrame(animId);
			resize(); // setting canvas.width/height resets the context transform
			tick();
		});
		ro.observe(canvas!);

		return () => {
			cancelAnimationFrame(animId);
			ro.disconnect();
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="pointer-events-none absolute inset-0 h-full w-full"
	aria-hidden="true"
/>
