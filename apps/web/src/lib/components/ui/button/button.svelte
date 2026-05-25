<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	const buttonVariants = tv({
		base: "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] text-sm font-medium overflow-hidden transition-[color,background-color,box-shadow] duration-[180ms] ease-out-quint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
		variants: {
			variant: {
				default:
					"btn-hud shadow-[inset_0_1px_0_oklch(1_0_0/0.22)] bg-primary text-primary-foreground uppercase tracking-[0.07em] hover:bg-[oklch(0.715_0.100_205)] hover:shadow-[0_0_0_3px_oklch(0.715_0.100_205_/_0.35)]",
				destructive: "bg-destructive text-destructive-foreground uppercase tracking-[0.06em] hover:bg-destructive/90",
				outline: "border border-input bg-transparent text-foreground uppercase tracking-[0.06em] hover:bg-secondary",
				secondary: "bg-secondary text-secondary-foreground uppercase tracking-[0.06em] hover:bg-secondary/80",
				ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-5 py-2",
				sm: "h-8 rounded-[3px] px-3 text-xs",
				lg: "h-12 px-7 py-3 text-[0.875rem]",
				icon: "h-9 w-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	type Props = HTMLButtonAttributes &
		VariantProps<typeof buttonVariants> & {
			class?: string;
		};

	let { class: className, variant, size, children, ...restProps }: Props = $props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
	{@render children?.()}
</button>
