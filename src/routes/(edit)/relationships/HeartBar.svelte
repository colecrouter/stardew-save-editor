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

	const info = $derived(Villagers.get(name));
	const portrait = $derived(asset(`/assets/portraits/${name}.png`));

	// Portrait sheets are a grid of 64px frames; scale the sheet so one frame fills the box
	let framesPerRow = $state(2);
	// The portrait grows to match the height of the details beside it
	let detailsHeight = $state(64);
	const portraitSize = $derived(Math.min(120, Math.max(64, detailsHeight)));
	let loaded = $state(false);
	$effect(() => {
		loaded = false;
		const image = new Image();
		image.onload = () => {
			framesPerRow = Math.max(1, Math.round(image.naturalWidth / 64));
			loaded = true;
		};
		image.src = portrait;
	});
</script>

<div class="row" data-testid="friendship-row">
	<UiContainerSmall>
		<div
			class="portrait"
			role="img"
			aria-label={`${name} portrait`}
			style:background-image={loaded ? `url("${portrait}")` : undefined}
			style:background-size={`${framesPerRow * 100}% auto`}
			style:width={`${portraitSize}px`}
			style:height={`${portraitSize}px`}
		>
			{#if !loaded}
				<strong aria-hidden="true">{name.slice(0, 1)}</strong>
			{/if}
		</div>
	</UiContainerSmall>

	<div class="main" bind:clientHeight={detailsHeight}>
		<div class="header">
			<strong data-testid="friendship-name">{name}</strong>
		</div>
		{#if info?.description}
			<small
				class="description"
				title={info.description}
				data-testid="friendship-description">{info.description}</small
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

		{#if info?.loves.length}
			<ul class="loves" aria-label={`${name}'s loved gifts`}>
				{#each info.loves as gift (gift.item)}
					<li title={`Loves: ${gift.name}`} data-testid="friendship-loved-gift">
						<ItemSprite item={Item.fromName(gift.item)} />
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
		border: 2px solid #f0d2a8;
		border-radius: 2px;
		background-repeat: no-repeat;
		background-position: left top;
		image-rendering: pixelated;
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
		gap: 6px;
		min-width: 0;
		align-content: center;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}

	/* Slightly smaller hearts so all 14 fit on one line beside the larger portrait */
	.main :global(.range button),
	.main :global(.range .locked) {
		width: 1.2rem;
		height: 1.2rem;
		font-size: 0.95rem;
	}

	.description {
		font-size: 0.75em;
		opacity: 0.8;
		/* Keep rows a steady height; the full text is in the tooltip */
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
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
