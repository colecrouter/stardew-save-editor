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
								informative
								text={gift.tooltip}
								aria-label={gift.tooltip}
								class="gift-icon"
							>
								<BackpackItemVisual visual={gift.visual} size={24} />
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
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px 14px;
		min-width: 0;
		font-size: 16px;
	}
	.gift-group {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
		min-width: 0;
	}
	.label {
		color: var(--study-muted, #815327);
		white-space: nowrap;
	}
	.icons {
		display: flex;
		flex-wrap: wrap;
		gap: 1px;
	}
	.icons :global(.gift-icon) {
		padding: 0;
		min-width: 0;
		display: grid;
		place-items: center;
	}
</style>
