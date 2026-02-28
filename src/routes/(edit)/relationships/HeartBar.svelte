<script lang="ts">
	import { asset } from "$app/paths";
	import type { Friendship } from "$lib/proxies/Friendship.svelte";
	import EmojiRange from "$lib/ui/EmojiRange.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";

	interface Props {
		name: string;
		npc: Friendship;
	}

	let { npc, name }: Props = $props();
</script>

<div class="row" data-testid="friendship-row">
	<UiContainerSmall>
		<div
			class="portrait"
			style:background-image={`url('${asset(`/assets/portraits/${name}.png`)}')`}
		></div>
	</UiContainerSmall>

	<div class="main">
		<div class="header">
			<strong data-testid="friendship-name">{name}</strong>
		</div>

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
		width: 64px;
		height: 64px;
		background-size: 200% auto;
		border: 2px solid #f0d2a8;
		border-radius: 2px;
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
</style>
