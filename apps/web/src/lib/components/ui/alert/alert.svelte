<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn } from "$lib/utils";

	const alertVariants = tv({
		base: "relative w-full rounded-lg px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
		variants: {
			variant: {
				default: "bg-card text-foreground shadow-soft",
				destructive: "bg-destructive/[0.08] text-destructive [&>svg]:text-destructive",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	type Props = HTMLAttributes<HTMLDivElement> &
		VariantProps<typeof alertVariants> & {
			class?: string;
		};

	let { class: className, variant, children, ...restProps }: Props = $props();
</script>

<div role="alert" class={cn(alertVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</div>
