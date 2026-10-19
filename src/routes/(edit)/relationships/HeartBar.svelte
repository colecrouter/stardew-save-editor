<script lang="ts">
	import { asset } from "$app/paths";
	import type { Friendship } from "$lib/proxies/Friendship.svelte";
	import EmojiRange from "$lib/ui/EmojiRange.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import { Villagers } from "$lib/Villagers";

	interface Props {
		name: string;
		npc: Friendship;
	}

	let { npc, name }: Props = $props();

	const description = $derived(Villagers.get(name)?.description);
	// The name comes from the save and ends up in a CSS url(), so encode it
	const portrait = $derived(
		asset(`/assets/portraits/${encodeURIComponent(name)}.png`),
	);

	// The portrait grows to match the height of the details beside it
	let detailsHeight = $state(64);
	const portraitSize = $derived(Math.min(120, Math.max(64, detailsHeight)));
	// Portrait sheets are a grid of 64px frames; scale the sheet so one frame fills the box
	let framesPerRow = $state(2);
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

	/* Slightly smaller hearts so all 14 fit on one line beside the larger portrait */
	.main :global(.range button),
	.main :global(.range .locked) {
		width: 1.2rem;
		height: 1.2rem;
		font-size: 0.95rem;
	}
</style>
