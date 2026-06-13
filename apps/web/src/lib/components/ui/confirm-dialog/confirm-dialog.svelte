<script lang="ts">
	import { Dialog } from "$lib/components/ui/dialog";
	import { Button } from "$lib/components/ui/button";

	// Destructive-action confirmation. Wraps the shared Dialog with the standard body:
	// title · message · the named subject in a tinted pill · cancel / confirm actions.
	// Used by every delete flow (recipe list, recipe edit, food list) so the wording,
	// spacing, and button order stay identical everywhere.
	type Props = {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title: string;
		message: string;
		/** The subject being acted on (recipe / product name), shown in a tinted pill. */
		subject: string;
		confirmLabel: string;
		cancelLabel: string;
		onConfirm: () => void;
		onCancel: () => void;
		/** Disables both buttons while the action is in flight. */
		pending?: boolean;
	};

	let {
		open,
		onOpenChange,
		title,
		message,
		subject,
		confirmLabel,
		cancelLabel,
		onConfirm,
		onCancel,
		pending = false,
	}: Props = $props();
</script>

<Dialog {open} {onOpenChange} {title} closeLabel={cancelLabel}>
	<div class="px-6 pb-[22px] pt-[26px]">
		<h2 class="text-[1.125rem] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
		<p class="mt-2 text-sm leading-normal text-muted-foreground">{message}</p>
		<p class="mt-3 break-words rounded-sm bg-secondary px-3 py-2.5 text-[0.9375rem] font-semibold text-foreground">
			{subject}
		</p>
		<div class="mt-[22px] flex justify-end gap-2.5">
			<Button variant="secondary" onclick={onCancel} disabled={pending}>{cancelLabel}</Button>
			<Button variant="destructive" onclick={onConfirm} disabled={pending}>{confirmLabel}</Button>
		</div>
	</div>
</Dialog>
