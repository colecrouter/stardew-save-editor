<script lang="ts">
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const game = save.raw.SaveGame;

	// Every farmer stores their own copy of the farm-wide settings below, so edits go to all of them
	const host = $derived(save.players[0]);

	const profitMargins = [
		[1, "Normal"],
		[0.75, "75%"],
		[0.5, "50%"],
		[0.25, "25%"],
	] as const;

	// whichFarm values; 7 is a custom farm type such as Meadowlands
	const farmTypes = [
		"Standard",
		"Riverland",
		"Forest",
		"Hill-top",
		"Wilderness",
		"Four Corners",
		"Beach",
		"Meadowlands (or modded)",
	];

	// Set when the farm was created; changing them in an existing save can corrupt or desync it
	const locked = [
		[
			"Farm type",
			farmTypes[game.whichFarm] ?? `Unknown (${game.whichFarm})`,
			"The map layout is fixed. Changing it leaves buildings, crops and objects in invalid spots.",
		],
		[
			"Community Center bundles",
			"Set at creation",
			"The chosen bundles are already saved. Edit individual bundles on the Community Center page instead.",
		],
		[
			"Guarantee Year 1 completable",
			game.visitsUntilY1Guarantee >= 0 ? "On" : "Off",
			"Tracked by a Traveling Cart visit counter the game manages.",
		],
		[
			"Money",
			game.player.useSeparateWallets ? "Separate wallets" : "Shared",
			"Change this in-game with the ledger in the Mayor's Manor, which correctly splits or merges everyone's gold.",
		],
		[
			"Random seed",
			String(game.uniqueIDForThisGame),
			"The save's folder and file name include this number. Changing it breaks the save.",
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
				value={host?.farmName ?? ""}
				oninput={(e) => {
					const name = (e.target as HTMLInputElement).value;
					for (const player of save.players) player.farmName = name;
				}}
				data-testid="farm-name"
				data-sentry-mask
			/>
		</label>
		<label>
			Profit Margin
			<UiSelect
				value={host?.difficultyModifier ?? 1}
				onchange={(e) => {
					const margin = Number(e.currentTarget.value);
					for (const player of save.players) player.difficultyModifier = margin;
				}}
				data-testid="profit-margin"
			>
				{#each profitMargins as [value, label]}
					<option {value}>{label}</option>
				{/each}
				{#if host && !profitMargins.some(([v]) => v === host.difficultyModifier)}
					<option value={host.difficultyModifier}
						>Custom ({Math.round(host.difficultyModifier * 100)}%)</option
					>
				{/if}
			</UiSelect>
		</label>
		<small>Multiplies the price of items you sell and seeds you buy.</small>
		<label>
			Spawn Monsters on the Farm
			<UiCheckbox
				bind:checked={save.shouldSpawnMonsters}
				data-testid="spawn-monsters"
			/>
		</label>
		<small>Takes effect from the next night.</small>
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
