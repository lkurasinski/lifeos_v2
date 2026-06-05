<script lang="ts">
	import { Dialog as Primitive } from "bits-ui";
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils";

	// Glass modal built on the Bits UI Dialog primitive: focus trap, scroll lock, and
	// ESC-to-close come for free. Controlled via `open` + `onOpenChange` so the caller
	// can wire it to shallow routing (browser-back closes it). `title` is required for
	// accessibility and rendered visually hidden — the body supplies its own heading.
	type Props = {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		title: string;
		closeLabel?: string;
		children?: Snippet;
		class?: string;
	};

	let { open = false, onOpenChange, title, closeLabel = "Zamknij", children, class: className }: Props =
		$props();
</script>

<Primitive.Root {open} {onOpenChange}>
	<Primitive.Portal>
		<Primitive.Overlay class="dialog-overlay" />
		<Primitive.Content class={cn("dialog-content", className)}>
			<Primitive.Title class="sr-only">{title}</Primitive.Title>
			<Primitive.Close class="dialog-close" aria-label={closeLabel}>
				<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
						clip-rule="evenodd"
					/>
				</svg>
			</Primitive.Close>
			{@render children?.()}
		</Primitive.Content>
	</Primitive.Portal>
</Primitive.Root>

<style>
	:global(.dialog-overlay) {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: oklch(0.2 0.006 72 / 0.42);
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
	}
	:global(.dialog-content) {
		position: fixed;
		z-index: 51;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(440px, calc(100vw - 32px));
		max-height: min(85vh, 760px);
		overflow-y: auto;
		background: var(--card);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lift);
	}
	:global(.dialog-content::-webkit-scrollbar) {
		display: none;
	}
	:global(.dialog-close) {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--secondary);
		color: var(--muted-foreground);
		cursor: pointer;
		transition: background-color 150ms var(--ease), color 150ms var(--ease);
	}
	:global(.dialog-close svg) {
		width: 18px;
		height: 18px;
	}
	:global(.dialog-close:hover) {
		background: var(--accent);
		color: var(--foreground);
	}
	:global(.dialog-close:focus-visible) {
		outline: none;
		box-shadow: var(--focus);
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.dialog-overlay[data-state="open"]) {
			animation: dialog-fade 180ms var(--ease) both;
		}
		:global(.dialog-content[data-state="open"]) {
			animation: dialog-pop 220ms var(--ease) both;
		}
		@keyframes dialog-fade {
			from {
				opacity: 0;
			}
		}
		@keyframes dialog-pop {
			from {
				opacity: 0;
				transform: translate(-50%, -48%) scale(0.97);
			}
		}
	}

	/* Bottom-sheet feel on small phones: full-width, anchored to the bottom. */
	@media (max-width: 480px) {
		:global(.dialog-content) {
			top: auto;
			bottom: 0;
			left: 0;
			transform: none;
			width: 100%;
			max-height: 88vh;
			border-radius: var(--radius) var(--radius) 0 0;
		}
		@media (prefers-reduced-motion: no-preference) {
			:global(.dialog-content[data-state="open"]) {
				animation: dialog-sheet 240ms var(--ease) both;
			}
			@keyframes dialog-sheet {
				from {
					transform: translateY(12px);
					opacity: 0;
				}
			}
		}
	}
</style>
