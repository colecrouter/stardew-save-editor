<script lang="ts" module>
	const seasons = new Map([
		[0, "Spring"],
		[1, "Summer"],
		[2, "Fall"],
		[3, "Winter"],
	]);
</script>

<script lang="ts">
	import type { Farmer } from "$lib/proxies/Farmer.svelte";
	import { draggable, droppable, type DragDropState } from "@thisux/sveltednd";
	import Character from "../appearance/Character.svelte";

	interface Props {
		farmers: Farmer[];
	}

	let { farmers = $bindable() }: Props = $props();

	function swapFarmer(state: DragDropState) {
		const { sourceContainer, targetContainer } = state;
		const sourceIndex = Number(sourceContainer);
		const targetIndex = Number(targetContainer);

		let newFarmers = farmers;

		const currentFarmer = newFarmers[sourceIndex];
		const swappingFarmer = newFarmers[targetIndex];
		if (!currentFarmer || !swappingFarmer) return;

		newFarmers[sourceIndex] = swappingFarmer;
		newFarmers[targetIndex] = currentFarmer;

		farmers = newFarmers; // trigger setter
	}

	function deleteFarmer(index: number) {
		farmers = farmers.filter((_, i) => i !== index);
	}
</script>

<div class="container">
	{#each farmers as farmer, index}
		<div
			use:droppable={{
				container: index.toString(),
				callbacks: { onDrop: swapFarmer },
			}}
			class:disabled={farmers.length === 1}
		>
			<div
				class="wrapper"
				use:draggable={{ container: index.toString(), dragData: "asd" }}
			>
				{@render card(farmer, index)}
			</div>
		</div>
	{/each}
</div>

{#snippet card(farmer: Farmer, index: number)}
	{@const hoursPlayed = Math.floor(
		farmer.raw.millisecondsPlayed / 1000 / 60 / 60,
	)}
	{@const minutesPlayed = Math.floor(
		(farmer.raw.millisecondsPlayed / 1000 / 60) % 60,
	)}
	{@const moneyEarned = farmer.raw.totalMoneyEarned}
	{@const season = seasons.get(farmer.raw.seasonForSaveGame)}
	{@const day = farmer.raw.dayOfMonthForSaveGame}
	{@const year = farmer.raw.yearForSaveGame}
	{@const farmName = farmer.raw.farmName}
	<div class="outer">
		<div class="inner">
			<div class="content">
				<div class="left">
					<div class="number">
						{index + 1}.
					</div>
					<div class="character">
						<Character player={farmer} />
					</div>
					<div class="details">
						<h2 class="name">
							{farmer.name}
						</h2>
						<div class="date">
							Day {day} of {season}, Year {year}
						</div>
					</div>
				</div>
				<div class="right">
					<div class="farm-name">
						{farmName} Farm
					</div>
					<div class="stats">
						<div class="stat">
							<label for="money-earned" hidden>Money Earned</label>
							<span id="money-earned" aria-label="Money Earned">
								💵 {moneyEarned}
							</span>
						</div>
						<div class="stat">
							<label for="time-played" hidden>Time Played</label>
							<span id="time-played" aria-label="Time Played">
								🕒 {hoursPlayed}:{minutesPlayed}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/snippet}

<style>
	.container {
		display: flex;
		flex-direction: column;
		gap: 5px;
		min-height: 200px;
	}

	.wrapper {
		border: 1px solid #6f3b31;
		border-radius: 2px;
	}

	.outer {
		border: 2px solid #fff;
		border-radius: 3px;
	}

	.inner {
		border: 2px solid #9c613b;
	}

	.content {
		padding: 1rem;
		margin: -2px;
		border: 2px solid #9c613b;
		border-radius: 10px;
		display: flex;
		justify-content: space-between;
	}

	.left {
		display: flex;
		justify-content: stretch;
		width: 100%;
	}

	.number {
		font-size: large;
		font-weight: bold;
		margin-right: 8px;
	}

	.character {
		max-height: 60px;
		transform: translateY(-10px);
	}

	.details {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		margin-left: 8px;
	}

	.right {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: flex-end;
	}

	.details > h2 {
		padding: 0;
		font-size: large;
	}

	.stats {
		text-align: right;
	}

	.stat {
		display: inline-block;
	}

	.farm-name {
		font-style: italic;
	}

	:global(.dragging) {
		opacity: 0.5;
	}

	.container :global(.drag-over) {
		box-shadow: 0 2px 2px blue;
		margin-bottom: 3px;
	}

	.disabled {
		opacity: 0.5;
		pointer-events: none;
		touch-action: none;
	}
</style>
