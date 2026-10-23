<script lang="ts">
	import { asset } from "$app/paths";
	import { LovedGifts } from "$lib/LovedGifts";
	import type { Friendship } from "$lib/proxies/Friendship.svelte";
	import EmojiRange from "$lib/ui/EmojiRange.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import { Villagers } from "$lib/Villagers";
	import type { LovedGift } from "$types/giftTastes";
	import GiftIcon from "./GiftIcon.svelte";

	interface Props {
		name: string;
		npc: Friendship;
	}

	let { npc, name }: Props = $props();

	const description = $derived(Villagers.get(name)?.description);
	const loves = $derived(LovedGifts.get(name)?.loves ?? []);
	const universalLoves = $derived(LovedGifts.get(name)?.universalLoves ?? []);
</script>

{#snippet giftList(gifts: LovedGift[], listLabel: string, testId: string)}
	<ul aria-label={listLabel}>
		{#each gifts as gift (gift.name)}
			<li><GiftIcon {gift} {testId} /></li>
		{/each}
	</ul>
{/snippet}

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

		{#if loves.length > 0 || universalLoves.length > 0}
			<div class="loves">
				{#if loves.length > 0}
					<div class="group">
						<small class="label" aria-hidden="true">Loves:</small>
						{@render giftList(
							loves,
							`${name}'s loved gifts`,
							"friendship-loved-gift",
						)}
					</div>
				{/if}
				{#if universalLoves.length > 0}
					<!-- Universal loves that this villager doesn't override -->
					<div class="group universal">
						<small
							class="label"
							aria-hidden="true"
							title="Gifts almost every villager loves">Universal loves:</small
						>
						{@render giftList(
							universalLoves,
							`${name}'s universal loves`,
							"friendship-universal-love",
						)}
					</div>
				{/if}
			</div>
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

	.loves,
	.loves ul,
	.loves li,
	.group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
	}

	.loves {
		column-gap: 8px;
	}

	.loves ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.group {
		gap: 4px;
	}

	.label {
		font-size: 0.75em;
		opacity: 0.8;
	}

	/* Set the universal loves apart from the villager's own */
	.universal {
		padding-left: 8px;
		border-left: 2px solid #da9457;
	}
</style>
