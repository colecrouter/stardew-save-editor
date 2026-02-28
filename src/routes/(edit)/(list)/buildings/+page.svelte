<script lang="ts">
	import { Raw } from "$lib/proxies";
	import type { FarmAnimal } from "$lib/proxies/FarmAnimal.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import EmojiRange from "$lib/ui/EmojiRange.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import { Gender } from "$types/save";
	import BuildingSprite from "../../inventory/BuildingSprite.svelte";

	let saveManager: ReturnType<typeof getSaveManager> | undefined;
	try {
		saveManager = getSaveManager();
	} catch {
		saveManager = undefined;
	}

	const save = $derived(saveManager?.save);
	const locations = $derived(save?.locations ?? []);

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

	const STAT_STEPS = 5;

	function getAnimalEmoji(type: string): string {
		return animalEmojis[type] || "🐾";
	}

	function toStepValue(value: number, max: number, steps = STAT_STEPS): number {
		if (max <= 0) return 0;
		return Math.max(0, Math.min(steps, Math.round((value / max) * steps)));
	}

	function fromStepValue(
		value: number,
		max: number,
		steps = STAT_STEPS,
	): number {
		return Math.max(0, Math.min(max, Math.round((value / steps) * max)));
	}

	function setFriendship(animal: FarmAnimal, level: number) {
		animal.friendshipTowardFarmer = fromStepValue(level, animal.maxFriendship);
	}

	function setHappiness(animal: FarmAnimal, level: number) {
		animal.happiness = fromStepValue(level, 255);
	}

	function setFullness(animal: FarmAnimal, level: number) {
		animal.fullness = fromStepValue(level, 255);
	}

	function getAnimalGender(animal: FarmAnimal): Gender {
		return animal.gender ?? Gender.Undefined;
	}
</script>

<UiContainer>
	<h1>Buildings</h1>

	{#each locations as location (location[Raw].name)}
		{#if location.buildings.length}
			<section class="location">
				<h2>{location[Raw].name}</h2>

				<div class="building-list">
					{#each location.buildings as building (building[Raw].id)}
						<section class="building-row">
							<div class="media">
								<div class="media-frame">
									<BuildingSprite {building} />
								</div>
							</div>

							<div class="content">
								<div class="building-header">
									<div>
										<h3>{building.name}</h3>
										{#if building.indoorLocation?.animals}
											{@const max = building.data?.maxOccupants ?? "??"}
											{@const animals = building.indoorLocation.animals.length}
											<small class="meta">{animals}/{max} animals inside</small>
										{/if}
									</div>

									{#if building.repaired !== undefined}
										<label class="toggle">
											<span>Repaired</span>
											<UiCheckbox bind:checked={building.repaired} />
										</label>
									{/if}
								</div>

								{#if building.indoorLocation?.animals?.length}
									<div class="animal-grid">
										{#each building.indoorLocation.animals as animal (animal[Raw].key.long)}
											<UiContainerSmall>
												<section class="animal-card">
													<header class="animal-card-header">
														<div class="animal-title">
															<span class="animal-emoji"
																>{getAnimalEmoji(animal.type)}</span
															>
															<div>
																<h4>{animal.name || animal.type}</h4>
																<small>{animal.type}</small>
															</div>
														</div>
													</header>

													<div class="stat-grid">
														<div class="stat-row">
															<small>Friendship</small>
															<EmojiRange
																value={toStepValue(
																	animal.friendshipTowardFarmer,
																	animal.maxFriendship,
																)}
																max={STAT_STEPS}
																inputValue={animal.friendshipTowardFarmer}
																inputMax={animal.maxFriendship}
																inputTestId="animal-friendship-input"
																filled="♥"
																empty="♡"
																testId="animal-friendship"
																ariaLabel={`${animal.name || animal.type} friendship`}
																onChange={(value) =>
																	setFriendship(animal, value)}
																onInputChange={(value) =>
																	(animal.friendshipTowardFarmer = value)}
															/>
														</div>

														<div class="stat-row">
															<small>Happiness</small>
															<EmojiRange
																value={toStepValue(animal.happiness, 255)}
																max={STAT_STEPS}
																inputValue={animal.happiness}
																inputMax={255}
																inputTestId="animal-happiness-input"
																filled="☻"
																empty="☺"
																testId="animal-happiness"
																ariaLabel={`${animal.name || animal.type} happiness`}
																onChange={(value) =>
																	setHappiness(animal, value)}
																onInputChange={(value) =>
																	(animal.happiness = value)}
															/>
														</div>

														<div class="stat-row">
															<small>Fullness</small>
															<EmojiRange
																value={toStepValue(animal.fullness, 255)}
																max={STAT_STEPS}
																inputValue={animal.fullness}
																inputMax={255}
																inputTestId="animal-fullness-input"
																filled="✿"
																empty="❀"
																testId="animal-fullness"
																ariaLabel={`${animal.name || animal.type} fullness`}
																onChange={(value) => setFullness(animal, value)}
																onInputChange={(value) =>
																	(animal.fullness = value)}
															/>
														</div>
													</div>

													<div class="animal-fields">
														<div class="animal-field">
															<small>Name</small>
															<UiInput
																bind:value={animal.name}
																type="text"
																data-testid="animal-name-input"
															/>
														</div>

														<div class="animal-field">
															<small>Days Owned</small>
															<UiInput
																bind:value={animal.daysOwned}
																type="number"
																min={0}
																data-testid="animal-days-owned-input"
															/>
														</div>

														<div class="animal-field">
															<small>Gender</small>
															<div class="gender-selector">
																<button
																	type="button"
																	data-testid="animal-gender-male"
																	class:active={getAnimalGender(animal) ===
																		Gender.Male}
																	aria-pressed={getAnimalGender(animal) ===
																		Gender.Male}
																	aria-label={`${animal.name || animal.type} male`}
																	onclick={() => (animal.gender = Gender.Male)}
																>
																	🚹
																</button>
																<button
																	type="button"
																	data-testid="animal-gender-female"
																	class:active={getAnimalGender(animal) ===
																		Gender.Female}
																	aria-pressed={getAnimalGender(animal) ===
																		Gender.Female}
																	aria-label={`${animal.name || animal.type} female`}
																	onclick={() =>
																		(animal.gender = Gender.Female)}
																>
																	🚺
																</button>
																<button
																	type="button"
																	data-testid="animal-gender-undefined"
																	class:active={getAnimalGender(animal) ===
																		Gender.Undefined}
																	aria-pressed={getAnimalGender(animal) ===
																		Gender.Undefined}
																	aria-label={`${animal.name || animal.type} undefined gender`}
																	onclick={() =>
																		(animal.gender = Gender.Undefined)}
																>
																	?
																</button>
															</div>
														</div>
													</div>
												</section>
											</UiContainerSmall>
										{/each}
									</div>
								{/if}
							</div>
						</section>
					{/each}
				</div>
			</section>
		{/if}
	{/each}
</UiContainer>

<style>
	.location + .location {
		margin-top: 1rem;
	}

	.location > h2 {
		margin-bottom: 0.5rem;
	}

	.building-list {
		display: grid;
		gap: 0.75rem;
	}

	.building-row {
		display: grid;
		grid-template-columns: min-content minmax(0, 1fr);
		gap: 12px;
		padding: 8px;
	}

	.content {
		min-width: 0;
	}

	.media-frame {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 76px;
		min-height: 76px;
	}

	.building-header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 12px;
		margin-bottom: 10px;
		padding-bottom: 8px;
		border-bottom: 2px solid rgba(177, 78, 5, 0.18);
	}

	h3,
	h4 {
		margin: 0;
		padding: 0;
	}

	.meta {
		color: #6f3b31;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
	}

	.animal-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 8px;
	}

	.animal-card {
		display: grid;
		gap: 10px;
		padding: 8px;
	}

	.animal-card-header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 10px;
	}

	.animal-title {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		min-width: 0;
	}

	.animal-title h4 {
		margin-bottom: 0.15rem;
	}

	.animal-title small {
		color: #6f3b31;
	}

	.animal-emoji {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		font-size: 1.5rem;
		line-height: 1;
		border-radius: 999px;
		background: rgba(255, 243, 220, 0.55);
		box-shadow: inset -1px 1px 0 rgba(177, 78, 5, 0.2);
	}

	.stat-grid,
	.animal-fields {
		display: grid;
		gap: 6px;
	}

	.stat-grid {
		padding-top: 8px;
		border-top: 2px solid rgba(177, 78, 5, 0.18);
	}

	.stat-row,
	.animal-field {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
	}

	.gender-selector {
		display: flex;
		gap: 6px;
	}

	.gender-selector button {
		all: unset;
		width: 2rem;
		height: 2rem;
		border-radius: 4px;
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 1rem;
		font-weight: bold;
		cursor: pointer;
		border: solid 2px #9c613b;
		border-bottom-color: #6f3b31;
		border-right-color: #6f3b31;
		background-color: #f9bb65;
		box-shadow:
			inset -2px 2px 0 #e38813,
			-2px 2px 1px rgba(0, 0, 0, 0.12);
	}

	.gender-selector button.active {
		filter: brightness(0.9);
	}

	@media (max-width: 700px) {
		.building-row {
			grid-template-columns: 1fr;
		}

		.stat-row,
		.animal-field,
		.building-header,
		.animal-card-header {
			grid-template-columns: 1fr;
			justify-items: start;
		}
	}
</style>
