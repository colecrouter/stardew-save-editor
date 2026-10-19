<script lang="ts">
	import { asset } from "$app/paths";
	import type { Friendship } from "$lib/proxies/Friendship.svelte";
	import EmojiRange from "$lib/ui/EmojiRange.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";

	interface Props {
		name: string;
		npc: Friendship;
	}

	let { npc, name }: Props = $props();
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
			<label
				class="gifts"
				title="Gifts given this week, which starts on Sunday. Villagers take 2 a week, plus one on their birthday, and a spouse one a day; a week with 2 gives +10 friendship when it ends. The count only lasts the week if they were given a gift this week: otherwise it goes back to 0 overnight, still giving the +10 if it's 2 or more."
			>
				🎁
				<UiInput
					type="number"
					min="0"
					max="7"
					bind:value={() => npc.giftsThisWeek,
					(v) => {
						// Cleared while typing: wait for a number
						if (v === null) return;
						npc.giftsThisWeek = Number(v);
					}}
					aria-label={`Gifts given to ${name} this week`}
					data-testid="friendship-gifts-week"
				/>
				<small>this week</small>
			</label>
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

	.gifts {
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
	}

	.gifts small {
		font-size: 0.75em;
		opacity: 0.8;
	}

	.gifts :global(input[type="number"]) {
		width: 2.5em;
	}
</style>
