<script lang="ts">
	import { NumberField } from "$lib/components/ui/number-field";
	import { t } from "$lib/i18n";
	import { parseAmount, type AmountField } from "./product-form";

	// One nutrient row in the product form's full-profile section: label + number input + unit.
	// The empty state (NULL = no data, distinct from a typed 0) renders dashed and dims the unit.
	// `value` is bindable so the parent's `values` record updates in place (it reads those values
	// for the per-group filled count and the save assembly).
	type Props = {
		label: string;
		unit: string;
		value: AmountField;
	};

	let { label, unit, value = $bindable() }: Props = $props();

	const empty = $derived(parseAmount(value) === null);
</script>

<div class="flex items-center justify-between gap-3 py-1.5 pl-4 pr-0.5">
	<span class="text-[0.8125rem] text-muted-foreground">{label}</span>
	<span class="flex shrink-0 items-center gap-1.5">
		<NumberField
			class="w-[84px]"
			inputClass={`py-[5px] tracking-[-0.01em] placeholder:italic placeholder:[font-variant-numeric:normal]${empty ? " border-dashed" : ""}`}
			inputmode="decimal"
			min="0"
			step="any"
			bind:value
			placeholder={t("add.noDataPlaceholder")}
			aria-label={label}
		/>
		<span class={["w-6 text-left text-[0.6875rem] text-muted-foreground", empty && "opacity-40"]}
			>{unit}</span
		>
	</span>
</div>
