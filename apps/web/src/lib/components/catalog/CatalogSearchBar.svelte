<script lang="ts">
	import { SearchInput } from "$lib/components/ui/search-input";
	import { t } from "$lib/i18n";

	// Topbar product search. Thin wrapper over the SearchInput primitive — the parent
	// owns debounce + URL navigation; this is a controlled field via bind:value.
	type Props = {
		value?: string;
		placeholder?: string;
		oninput?: () => void;
		onclear?: () => void;
	};

	let { value = $bindable(""), placeholder, oninput, onclear }: Props = $props();

	function clear() {
		value = "";
		onclear?.();
	}
</script>

<SearchInput
	class="max-w-[520px] flex-1"
	bind:value
	{placeholder}
	{oninput}
	onclear={clear}
	clearLabel={t("catalog.clearSearch")}
/>
