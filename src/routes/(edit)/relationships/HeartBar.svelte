<script lang="ts">
	import { base } from "$app/paths";
	import type { Friendship } from "$lib/proxies/Friendship.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";

	interface Props {
		name: string;
		npc: Friendship;
	}

	let { npc, name }: Props = $props();

	// TODO modding can cause more heart events (???)
</script>

<div class="row">
	<UiContainerSmall>
		<div
			class="portrait"
			style:background-image={`url('${base}/assets/portraits/${name}.png')`}
		></div>
	</UiContainerSmall>
	<div class="right">
		<div class="hearts">
			{#each Array(npc.maxHearts) as _, i}
				<button onclick={() => (npc.hearts = i + 1)}>
					{#if i < npc.hearts}
						❤️
					{:else}
						🖤
					{/if}
				</button>
			{/each}
			{#each Array(14 - npc.maxHearts) as _}
				<span>🏳️</span>
			{/each}
		</div>
		<UiInput
			type="number"
			class="amount"
			min="0"
			max={npc.maxPoints}
			bind:value={npc.points}
		/>
	</div>
	<strong>
		{name}
	</strong>
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: min-content auto;
		grid-template-rows: min-content 1em;
		flex-direction: row;
		gap: 8px;
		padding: 8px 2px;
		border-bottom: 2px solid #da9457;
	}

	.portrait {
		width: 64px;
		height: 64px;
		background-size: 200% auto;
		border: 2px solid #f0d2a8;
		border-radius: 2px;
	}

	.right {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: start;
		gap: 8px;
	}

	.hearts {
		display: flex;
		flex-direction: row;
		justify-content: space-evenly;
		width: 100%;
		text-shadow: -1px 1px 0 #000;
	}

	button {
		all: unset;
		cursor: pointer;
	}

	strong {
		text-align: center;
	}
</style>
