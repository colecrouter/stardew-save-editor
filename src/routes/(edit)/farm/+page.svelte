<script lang="ts">
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";

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
	<h3>Farm</h3>
	<div class="settings">
		<label>
			Farm Name
			<UiInput
				type="text"
				bind:value={() => host?.farmName ?? "",
				(name) => {
					for (const player of save.players) player.farmName = String(name);
				}}
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
					bind:value={() => Math.round((host?.difficultyModifier ?? 1) * 100),
					(percent) => {
						// Cleared while typing: wait for a number
						if (percent === null) return;
						for (const player of save.players)
							player.difficultyModifier = Number(percent) / 100;
					}}
					data-testid="profit-margin"
				/>
				%
			</span>
			<datalist id="profit-margin-presets">
				{#each profitMarginPresets as preset}
					<option value={preset}></option>
				{/each}
			</datalist>
		</label>
		<small
			>Multiplies the price of items you sell, and of seeds and saplings in
			shops. 100% is normal and the game offers 75%, 50% and 25%, but other
			values work too.</small
		>
		<label>
			Spawn Monsters on the Farm
			<UiCheckbox
				bind:checked={save.shouldSpawnMonsters}
				data-testid="spawn-monsters"
			/>
		</label>
		<small
			>Monsters can appear on the farm from 7pm. In the game, the Dark Shrine of
			Night Terrors in the Witch's Hut toggles this too.</small
		>
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

	<h3>Set when the farm was created</h3>
	<dl class="locked">
		{#each locked as [label, value, reason]}
			<div>
				<dt>{label}</dt>
				<dd data-testid="locked-setting">{value}</dd>
				<dd class="reason">{reason}</dd>
			</div>
		{/each}
	</dl>
</UiContainer>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 16px;
		font-weight: bold;
	}

	.settings label {
		display: grid;
		grid-template-columns: 1fr 14rem;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}

	.percent {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.settings label:has(:global(input[type="checkbox"])) {
		grid-template-columns: 1fr auto;
	}

	.settings small,
	.reason {
		font-size: x-small;
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
		font-weight: bold;
	}

	.locked dd {
		margin: 0;
	}

	.locked .reason {
		grid-column: 1 / -1;
	}
</style>
