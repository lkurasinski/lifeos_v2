<script lang="ts">
	import CategoryIcon from "$lib/components/catalog/CategoryIcon.svelte";

	// One result row in the ingredient picker's popover (locked by `form.html`): a leading icon
	// (product category glyph OR the sub-recipe nest mark), the name, and a meta sub-label.
	// Purely presentational — the parent `ProductPicker` formats the meta line and owns the pick.
	type Props = {
		kind: "product" | "subRecipe";
		/** Product category slug for the glyph; ignored for sub-recipes (which use the nest mark). */
		categorySlug?: string | null;
		name: string;
		meta: string;
		onSelect: () => void;
	};

	let { kind, categorySlug = null, name, meta, onSelect }: Props = $props();
</script>

<button type="button" class="pp-res" onclick={onSelect}>
	<span class="ri">
		{#if kind === "subRecipe"}
			<svg class="nest" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					d="M4 3.6A1.6 1.6 0 0 1 5.6 2H10v15.4l-.9-.5a3 3 0 0 0-1.5-.4H5.6A1.6 1.6 0 0 1 4 14.9V3.6Z"
				/>
				<path
					d="M16 3.6A1.6 1.6 0 0 0 14.4 2H10v15.4l.9-.5a3 3 0 0 1 1.5-.4h2A1.6 1.6 0 0 0 16 14.9V3.6Z"
					opacity=".5"
				/>
			</svg>
		{:else}
			<CategoryIcon slug={categorySlug} size={17} />
		{/if}
	</span>
	<span class="rb">
		<span class="rn">{name}</span>
		<span class="rm2">{meta}</span>
	</span>
</button>

<style>
	.pp-res {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		text-align: left;
		border: 0;
		background: transparent;
		border-radius: var(--radius-sm);
		padding: 8px 9px;
		cursor: pointer;
	}
	.pp-res:hover {
		background: var(--accent);
	}
	.pp-res .ri {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--secondary);
		color: var(--muted-foreground);
	}
	.pp-res .ri .nest {
		width: 17px;
		height: 17px;
	}
	.pp-res .rb {
		flex: 1;
		min-width: 0;
	}
	.pp-res .rn {
		display: block;
		font-size: 0.875rem;
		font-weight: 550;
		letter-spacing: -0.005em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.pp-res .rm2 {
		display: block;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
		margin-top: 1px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
