<script lang="ts">
	import { Raw } from "$lib/proxies";
	import type { Building } from "$lib/proxies/Building.svelte";
	import type { FarmAnimal } from "$lib/proxies/FarmAnimal.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import BuildingSprite from "../../inventory/BuildingSprite.svelte";
	import { Gender } from "$types/save";
	import StatBar from "$lib/ui/StatBar.svelte";

	const saveManager = getSaveManager();
	const save = $derived(saveManager.save);
	const locations = $derived(save?.locations ?? []);

	const properties = [["Repaired", "repaired"]];

	// Map animal types to emojis
	const animalEmojis: Record<string, string> = {
		"White Chicken": "🐔",
		"Brown Chicken": "🐔",
		"Blue Chicken": "🐔",
		"Void Chicken": "🐔",
		"Gold Chicken": "🐔",
		Duck: "🦆",
		Rabbit: "🐰",
		Dinosaur: "🦕",
		"White Cow": "🐮",
		"Brown Cow": "🐮",
		Goat: "🐐",
		Sheep: "🐑",
		Pig: "🐷",
		Ostrich: "🦤",
	};

	function getAnimalEmoji(type: string): string {
		return animalEmojis[type] || "🐾";
	}
</script>

<UiContainer>
	<h1>Buildings</h1>

	{#each locations as location}
		{#if location.buildings.length}
			<h2>{location[Raw].name}</h2>
			{#each location.buildings as building}
				<div class="container">
					<UiContainerSmall>
						<div class="bg">
							<BuildingSprite {building} />
						</div>
					</UiContainerSmall>
					<div>
						<h3>{building.name}</h3>
						<div class="options">
							{#if building.indoorLocation?.animals}
								{@const max = building.data?.maxOccupants ?? "??"}
								{@const animals = building.indoorLocation.animals.length}
								<small>
									<span>Animals</span>
									<var>{animals}/{max}</var>
								</small>
							{/if}

							{#each properties as [label, prop, min, max]}
								{#if building[prop] !== undefined}
									<label>
										<small>{label}</small>
										{#if typeof building[prop] === "number"}
											<UiInput
												bind:value={building[prop]}
												type="number"
												{min}
												{max}
											/>
										{:else if typeof building[prop] === "boolean"}
											<UiCheckbox bind:checked={building[prop]} />
										{/if}
									</label>
								{/if}
							{/each}
						</div>

						{#if building.indoorLocation?.animals?.length}
							<div class="animals">
								<h4>Animals</h4>
								{#each building.indoorLocation.animals as animal}
									<details class="animal">
										<summary>
											<span class="animal-emoji"
												>{getAnimalEmoji(animal.type)}</span
											>
											<span class="animal-name"
												>{animal.name || animal.type}</span
											>
										</summary>
										<div class="animal-options">
											<label>
												<small>Name</small>
												<UiInput bind:value={animal.name} type="text" />
											</label>
											<StatBar
												label="Happiness"
												emoji="😊"
												bind:value={animal.happiness}
												max={1000}
											/>
											<StatBar
												label="Fullness"
												emoji="🌾"
												bind:value={animal.fullness}
												max={255}
											/>
											<label>
												<small>Days Owned</small>
												<UiInput
													bind:value={animal.daysOwned}
													type="number"
													min={0}
												/>
											</label>
											<label>
												<small>Gender</small>
												<div class="gender-selector">
													<label>
														🚹
														<input
															type="radio"
															name="gender-{animal[Raw].key.long}"
															checked={animal.gender === Gender.Male}
															onclick={() => (animal.gender = Gender.Male)}
														/>
													</label>
													<label>
														🚺
														<input
															type="radio"
															name="gender-{animal[Raw].key.long}"
															checked={animal.gender === Gender.Female}
															onclick={() => (animal.gender = Gender.Female)}
														/>
													</label>
												</div>
											</label>
										</div>
									</details>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	{/each}
</UiContainer>

<style>
	.bg {
		background-image: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
			url(/img/wallpaper.jpg);
		background-size: 256px;
		background-position: bottom left;
		padding: 6px;
		width: 56px;
		height: 56px;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.container {
		display: flex;
		padding-bottom: 12px;
		gap: 8px;
		padding-left: 12px;
	}

	.container > div:nth-child(2) {
		width: 100%;
	}

	label {
		display: flex;
		align-items: center;
	}

	.options > * {
		display: flex;
		justify-content: space-between;
		max-width: 300px;
	}

	.options {
		display: grid;
		gap: 4px;
	}

	.animals {
		margin-top: 12px;
		padding-top: 8px;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}

	.animals h4 {
		margin: 0 0 8px 0;
		font-size: 0.9em;
		color: #6f3b31;
	}

	.animal {
		background: rgba(0, 0, 0, 0.03);
		padding: 8px;
		margin-bottom: 8px;
		border-radius: 4px;
	}

	.animal summary {
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		list-style: none;
	}

	.animal summary::-webkit-details-marker {
		display: inline;
	}

	.animal-emoji {
		font-size: 1.2em;
	}

	.animal-name {
		font-weight: bold;
		color: #9c613b;
	}

	.animal-options {
		margin-top: 8px;
		display: grid;
		gap: 4px;
		padding-left: 24px;
	}

	.animal-options > * {
		display: flex;
		justify-content: space-between;
		max-width: 300px;
	}

	.gender-selector {
		display: flex;
		flex-direction: row;
		justify-content: center;
	}

	.gender-selector input {
		appearance: none;
	}

	.gender-selector label {
		border-radius: 4px;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		padding-bottom: 0.1em;
		font-size: 1.2em;
		cursor: pointer;
		text-shadow: -0.05em 0.05em 0.1em rgba(0, 0, 0, 0.6);
	}

	.gender-selector label:has(input:checked) {
		border: solid 3px #d93703;
	}

	.gender-selector label:has(input:not(:checked)) {
		border: solid 3px #00000000;
	}

	.gender-selector label input {
		position: absolute;
	}
</style>
