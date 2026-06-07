<script lang="ts">
	import { IconButton } from "$lib/components/ui/icon-button";
	import { t } from "$lib/i18n";

	// Prev / next pager over the search result. Page count is derived from total/limit;
	// the parent drives navigation via onPage.
	type Props = {
		page: number;
		limit: number;
		total: number;
		onPage: (page: number) => void;
	};

	let { page, limit, total, onPage }: Props = $props();

	const pageCount = $derived(Math.max(1, Math.ceil(total / limit)));
	const canPrev = $derived(page > 1);
	const canNext = $derived(page < pageCount);
</script>

{#if pageCount > 1}
	<div class="flex items-center justify-center gap-3 pb-1 pt-[18px]">
		<IconButton
			size="sm"
			disabled={!canPrev}
			aria-label={t("catalog.prevPage")}
			onclick={() => canPrev && onPage(page - 1)}
		>
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path d="M12.5 5.5 8 10l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</IconButton>
		<span class="min-w-[4ch] text-center text-[0.8125rem] tabular-nums text-muted-foreground">{page} / {pageCount}</span>
		<IconButton
			size="sm"
			disabled={!canNext}
			aria-label={t("catalog.nextPage")}
			onclick={() => canNext && onPage(page + 1)}
		>
			<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path d="M7.5 5.5 12 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</IconButton>
	</div>
{/if}
