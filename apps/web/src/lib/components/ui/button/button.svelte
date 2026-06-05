<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	const buttonVariants = tv({
		base: "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-[180ms] ease-out-quint focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-[17px] [&_svg]:shrink-0",
		variants: {
			variant: {
				// Primary action: solid graphite block, off-white text, soft shadow
				// that lifts on hover and presses in on click. No brand color.
				default: "bg-primary text-primary-foreground shadow-soft hover:shadow-lift active:translate-y-px active:shadow-soft",
				// Secondary "glass": near-opaque card surface, graphite text, borderless.
				secondary: "bg-card text-foreground shadow-soft hover:bg-accent active:translate-y-px",
				outline: "border border-border bg-transparent text-foreground hover:bg-accent",
				ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
				link: "text-foreground underline-offset-4 hover:underline",
				// Semantic only — destructive is the one place a hue is permitted on a button.
				destructive: "bg-destructive text-destructive-foreground shadow-soft hover:opacity-90 active:translate-y-px",
			},
			size: {
				default: "h-10 px-5 py-2",
				sm: "h-8 rounded-md px-3 text-xs",
				lg: "h-12 px-7 py-3 text-[0.9375rem]",
				icon: "h-9 w-9 rounded-sm",
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
