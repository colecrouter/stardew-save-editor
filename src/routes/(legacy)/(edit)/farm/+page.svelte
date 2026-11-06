<script lang="ts">
	import StudyIcon from "$lib/ui/StudyIcon.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";
	import CalendarSettings from "./CalendarSettings.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const game = save.raw.SaveGame;

	// Every farmer stores their own copy of the farm name and profit margin, so edits go to all of them
	const host = $derived(save.players[0]);

	// The new-game presets; any percentage works since the game just multiplies prices by it
	const profitMarginPresets = [100, 75, 50, 25];

	// whichFarm is the index of a vanilla farm type, or the ID of Meadowlands or a modded farm type
	const farmTypes = [
		"Standard",
		"Riverland",
		"Forest",
		"Hill-top",
		"Wilderness",
		"Four Corners",
		"Beach",
	];
	const farmTypeIds: Record<string, string> = {
		MeadowlandsFarm: "Meadowlands",
	};
	const farmType =
		typeof game.whichFarm === "number"
			? (farmTypes[game.whichFarm] ?? `Unknown (${game.whichFarm})`)
			: (farmTypeIds[game.whichFarm] ?? `Custom (${game.whichFarm})`);

	// New-game options that can't safely be changed in an existing save
	const locked = [
		[
			"Farm type",
			farmType,
			"The map layout is fixed. Changing it leaves buildings, crops and objects in invalid spots.",
		],
		[
			"Community Center bundles",
			"Not recorded",
			"The save keeps the bundles this option picked, not the option itself. Bundle progress can be edited on the Community Center page.",
		],
		[
			"Guarantee Year 1 completable",
			game.visitsUntilY1Guarantee >= 0 ? "On" : "Off, or already used",
			"The save only keeps a countdown of Traveling Cart visits to the one that sells Red Cabbage seeds, and the game stops it after that visit.",
		],
		[
			"Money",
			game.player.useSeparateWallets ? "Separate wallets" : "Shared",
			"The host can change this in-game with the ledger in the Mayor's Manor, which splits or merges everyone's gold overnight.",
		],
		[
			"Random seed",
			String(game.uniqueIDForThisGame),
			"The save's folder and file are named after this number, so the game would save to a new folder. It also seeds much of the game's randomness.",
		],
		[
			"Legacy randomization",
			game.useLegacyRandom ? "On" : "Off",
			"Rolled items like trinkets are recalculated from it, so changing it alters their stats.",
		],
	] as const;
</script>

<UiContainer>
	<header class="farm-heading">
		<span class="farm-emblem"><StudyIcon name="farm" size={48} /></span>
		<div>
			<h1>Farm</h1>
			<p>Edit your farm settings, date, weather and related options.</p>
		</div>
	</header>
	<div class="farm-layout">
		<section class="farm-settings" aria-labelledby="farm-settings-title">
			<h2 id="farm-settings-title">Farm Settings</h2>
			<div class="settings">
				<label>
					Farm Name
					<UiInput
						type="text"
						bind:value={
							() => host?.farmName ?? "",
							(name) => {
								for (const player of save.players)
									player.farmName = String(name);
							}
						}
						data-testid="farm-name"
						data-sentry-mask
					/>
				</label>
				<label>
					Profit Margin
					<span class="percent">
						<UiInput
							type="number"
							min="1"
							max="1000"
							step="1"
							defaultValue={100}
							list="profit-margin-presets"
							bind:value={
								() => Math.round((host?.difficultyModifier ?? 1) * 100),
								(percent) => {
									// Cleared while typing: wait for a number
									if (percent === null) return;
									for (const player of save.players)
										player.difficultyModifier = Number(percent) / 100;
								}
							}
							data-testid="profit-margin"
						/>
						%
					</span>
					<datalist id="profit-margin-presets">
						{#each profitMarginPresets as preset (preset)}
							<option value={preset}></option>
						{/each}
					</datalist>
				</label>
				<small
					>Multiplies sale and seed shop prices. 100% is normal (game default).</small
				>
				<label>
					<UiCheckbox
						bind:checked={save.shouldSpawnMonsters}
						data-testid="spawn-monsters"
					/>
					Spawn Monsters on the Farm
				</label>
				<small>Allows monsters to spawn on your farm at night, from 7pm.</small>
				<label>
					Mine Rewards
					<UiSelect
						value={save.shuffleMineChests}
						onchange={(e) => (save.shuffleMineChests = e.currentTarget.value)}
						data-testid="mine-rewards"
					>
						<option value="Default">Normal</option>
						<option value="Remixed">Remixed</option>
					</UiSelect>
				</label>
				<small>Only changes chests you haven't opened yet.</small>
			</div>
		</section>

		<section class="date-settings" aria-label="Date and Weather">
			<h2>Date and Weather</h2>
			<CalendarSettings calendar={save.calendar} />
		</section>
	</div>

	<details class="creation-settings">
		<summary class="study-pane study-pane--thin"
			><StudyIcon name="tree" size={30} /><strong>Farm creation settings</strong
			><span>View settings recorded when this farm was created.</span></summary
		>
		<dl class="locked">
			{#each locked as [label, value, reason] (label)}
				<div>
					<dt>{label}</dt>
					<dd data-testid="locked-setting">{value}</dd>
					<dd class="reason">{reason}</dd>
				</div>
			{/each}
		</dl>
	</details>
</UiContainer>

<style>
	.farm-heading {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-bottom: 10px;
		border-bottom: 3px double #a97536;
		margin-bottom: 10px;
	}
	.farm-emblem {
		display: grid;
		place-items: center;
		flex: none;
	}
	.farm-heading h1 {
		margin-bottom: 2px;
	}
	.farm-heading p {
		margin: 0;
		font-size: 20px;
		line-height: 1.1;
	}
	.farm-layout {
		display: grid;
		grid-template-columns: minmax(240px, 0.95fr) minmax(0, 1.55fr);
		gap: 20px;
	}
	.farm-settings {
		padding-right: 18px;
		border-right: 2px solid #c39452;
	}
	.creation-settings {
		border-top: 3px double #a97536;
		margin-top: 8px;
		padding-top: 6px;
	}
	summary {
		padding: 6px 10px;
		font-size: 20px;
		line-height: 1.1;
		--pane-fill: linear-gradient(#fbd9a044, #f4cc8e33);
		--pane-outset: 0px;
		--pane-shadow: drop-shadow(1px 1px 0 #b3854570);
	}
	summary :global(svg) {
		vertical-align: middle;
		margin: 0 8px;
		width: 20px;
		height: 20px;
	}
	summary span {
		display: block;
		margin: 2px 0 0 48px;
		font-size: 17px;
		line-height: 1.1;
		color: #77542f;
	}
	.settings {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 0;
		font-weight: normal;
	}

	.settings label {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-items: center;
		gap: 4px;
		margin-top: 4px;
	}

	.percent {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.settings label:has(:global(input[type="checkbox"])) {
		grid-template-columns: auto minmax(0, 1fr);
		justify-content: start;
	}

	.settings small,
	.reason {
		font-size: 19px;
		line-height: 1.1;
		font-weight: normal;
		opacity: 0.8;
	}

	.locked {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 8px 16px;
	}

	.locked div {
		display: grid;
		grid-template-columns: 1fr auto;
		column-gap: 8px;
	}

	.locked dt {
		font-weight: normal;
	}

	.locked dd {
		margin: 0;
	}

	.locked .reason {
		grid-column: 1 / -1;
	}
	@media (max-width: 1000px) {
		.farm-layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.farm-settings {
			border-right: 0;
			padding-right: 0;
		}
	}
	@media (max-width: 760px) {
		.settings,
		.locked {
			padding-inline: 0;
		}
		.settings label {
			grid-template-columns: minmax(0, 1fr);
		}
		.locked div {
			grid-template-columns: minmax(0, 1fr);
		}
		.locked dd {
			overflow-wrap: anywhere;
		}
	}
</style>
