<script lang="ts">
	import { asset } from "$app/paths";
	import type { Friendship } from "$lib/proxies/Friendship.svelte";
	import { Item } from "$lib/proxies/Item.svelte";
	import EmojiRange from "$lib/ui/EmojiRange.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import { Villagers } from "$lib/Villagers";
	import ItemSprite from "../inventory/ItemSprite.svelte";

	interface Props {
		name: string;
		npc: Friendship;
	}

	let { npc, name }: Props = $props();

	const description = $derived(Villagers.get(name)?.description);
	const loves = $derived(Villagers.get(name)?.loves ?? []);
</script>

<div class="row" data-testid="friendship-row">
	<UiContainerSmall>
		<div class="portrait">
			<object
				data={asset(`/assets/portraits/${name}.png`)}
				type="image/png"
				aria-label={`${name} portrait`}
			>
				<strong aria-hidden="true">{name.slice(0, 1)}</strong>
			</object>
		</div>
	</UiContainerSmall>

	<div class="main">
		<div class="header">
			<strong data-testid="friendship-name">{name}</strong>
		</div>
		{#if description}
			<small class="description" data-testid="friendship-description"
				>{description}</small
			>
		{/if}

		<EmojiRange
			bind:value={npc.hearts}
			max={npc.maxHearts}
			total={14}
			inputValue={npc.points}
			inputMax={npc.maxPoints}
			inputTestId="friendship-points"
			filled="❤️"
			empty="🩶"
			locked="·"
			testId="friendship-heart"
			ariaLabel={`${name} hearts`}
			onInputChange={(value) => (npc.points = value)}
		/>

		{#if loves.length > 0}
			<ul class="loves" aria-label={`${name}'s loved gifts`}>
				{#each loves as gift (gift.item)}
					<li>
						<div
							role="img"
							aria-label={gift.name}
							title={gift.name}
							data-testid="friendship-loved-gift"
						>
							<ItemSprite item={Item.fromName(gift.item)} />
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: min-content minmax(0, 1fr);
		gap: 10px;
		padding: 10px 2px;
		border-bottom: 2px solid #da9457;
		align-items: center;
	}

	.portrait {
		position: relative;
		width: 64px;
		height: 64px;
		border: 2px solid #f0d2a8;
		border-radius: 2px;
	}

	.portrait object {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: none;
		object-position: left top;
	}

	.portrait strong {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: linear-gradient(#5a3978, #2e214d);
		color: #f7d779;
		font-size: 2rem;
	}

	.main {
		display: grid;
		gap: 8px;
		min-width: 0;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}

	.description {
		font-size: 0.75em;
		opacity: 0.8;
	}

	.loves {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
		/* Shrink the 32px item sprites to small icons */
		zoom: 0.75;
	}
</style>
