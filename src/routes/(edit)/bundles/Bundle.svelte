<script lang="ts">
import type { Bundle } from "$lib/proxies/CommunityBundles.svelte";
import { colorMap } from "$types/colors";
import BundleItem from "./BundleItem.svelte";

interface Props {
	bundle: Bundle;
}

let { bundle }: Props = $props();

let color = $derived(bundle.color ?? 0);

// Junimo Note
const sheet = "url(/assets/JunimoNote.png)";

let posX = $derived(
	`${(color % 2) * (-16 * 16) + (bundle.completed ? -224 : 0)}px`,
);
let posY = $derived(`${Math.floor(color / 2) * 16 - 48}px`);

const colors = new Map<number, string>([
	[0, "color_green"],
	[1, "color_purple"],
	[2, "color_orange"],
	[3, "color_yellow"],
	[4, "color_red"],
	[5, "color_blue"],
	[6, "color_cyan"],
]);
</script>

<div
	class="card"
	data-testid="bundle-card"
	data-bundle-name={bundle.name}
	style:--color={colorMap.get(colors.get(color) ?? "")}
>
	<details>
		<summary>
			<div class="header">
				<div
					class="icon"
					style:--sheet={sheet}
					style:--x={posX}
					style:--y={posY}
				></div>
				<h2>{bundle.name} Bundle</h2>
			</div>
		</summary>

		<h3>
			Required Items
			<span>
				({bundle.requiredItems.filter((i) => i.submitted)
					.length}/{bundle.requiredItemCount})
			</span>
		</h3>

		<div class="container" data-testid="bundle-required-items">
			{#each bundle.requiredItems as itemdata}
				<span data-testid="bundle-required-item">
					<BundleItem
						itemId={itemdata.itemID}
						type="O"
						quantity={itemdata.quantity}
						quality={itemdata.quality}
						bind:checked={itemdata.submitted}
					/>
				</span>
			{/each}
		</div>

		<h3>Reward</h3>

		<div class="row" data-testid="bundle-reward">
			{#if bundle.reward?.item}
				<BundleItem
					itemId={bundle.reward.item.id}
					type={bundle.reward.item.type}
					quantity={bundle.reward.item.quantity}
				/>
			{/if}
		</div>
	</details>
</div>

<style>
	.icon {
		width: 16px;
		height: 16px;
		background-position: left var(--x) bottom var(--y);
		background-image: var(--sheet);
		zoom: 2;
		position: absolute;
	}

	.header {
		display: inline-flex;

		h2 {
			margin-bottom: 4px;
			margin-left: 32px;
		}
	}

	.card {
		font-size: smaller;
		position: relative;
		margin: 8px;
		padding: 8px 12px;
	}

	.card::before {
		content: "";
		position: absolute;
		width: 100%;
		height: 100%;
		top: 0;
		left: 0;
		background-color: var(--color);
		filter: contrast(0.5);
		border-radius: 8px;
	}

	.card > * {
		position: relative;
	}

	summary::-webkit-details-marker {
		display: inline;
	}

	h3 {
		margin-top: 8px;
		border-bottom: 2px solid #0004;
	}

	.container {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
	}
</style>
