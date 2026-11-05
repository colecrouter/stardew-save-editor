<script lang="ts">
	import { relationshipGifts } from "../relationship-gifts.ts";
	import StudyTooltip from "../../ui/kit/StudyTooltip.svelte";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	interface Props {
		name: string;
	}
	let { name }: Props = $props();
	const gifts = $derived(relationshipGifts(name));
</script>

<!-- Recommendations are catalog data, including for missing saved friendships.
     Focusable tooltip triggers make the same names reachable without hovering. -->
{#if gifts.loves.length || gifts.universalLoves.length}
	<div class="gift-guidance" aria-label={`${name}'s loved gifts`}>
		{#each [{ label: "Loves", items: gifts.loves }, { label: "Universal loves", items: gifts.universalLoves }] as group (group.label)}
			{#if group.items.length}
				<div class="gift-group">
					<span class="label">{group.label}:</span>

					<div class="icons">
						{#each group.items as gift (gift.name)}
							<StudyTooltip
								text={gift.tooltip}
								aria-label={gift.tooltip}
								class="gift-icon"
							>
								<BackpackItemVisual visual={gift.visual} />
							</StudyTooltip>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.gift-guidance {
		display: grid;
		gap: 0.3rem;
		margin-top: 0.5rem;
	}
	.gift-group {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.label {
		color: var(--study-muted, #815327);
		font-size: 0.85rem;
	}
	.icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem;
	}
	.icons :global(.gift-icon) {
		padding: 0.15rem;
		min-width: 0;
		border: 1px solid transparent;
		box-shadow: none;
		background: transparent;
		display: grid;
		place-items: center;
	}
	.icons :global(.gift-icon:hover),
	.icons :global(.gift-icon:focus-visible) {
		border-color: var(--study-border, #b88b50);
		background: var(--study-surface, #fff2cf);
	}
</style>
