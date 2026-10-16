<script lang="ts">
	import { ItemNameHelper } from "$lib/ItemData";
	import {
		BACKPACK_SIZES,
		HOUSE_UPGRADE_DAYS,
		MAX_HOUSE_UPGRADE_LEVEL,
		TOOL_UPGRADE_DAYS,
	} from "$lib/proxies/Farmer.svelte";
	import { MailFlag } from "$lib/proxies/Mail.svelte";
	import {
		masteryLevel,
		masteryXpForLevel,
		Skill,
	} from "$lib/proxies/Skills.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";
	import Professions from "./Professions.svelte";
	import SkillBar from "./SkillBar.svelte";
	import WalletItem from "./WalletItem.svelte";

	const save = getSaveManager().save;
	const player = save?.player;
	const farm = save?.farm;
	if (!player || !farm || !save) throw new Error("No player data found");

	// Follow the selected farmer: the page stays mounted when the sidebar switches farmer
	const mail = $derived(save.player.mailReceived);

	const unlocks = [
		["📙", MailFlag.HasDwarvishTranslationGuide, "Dwarvish Translation Guide"],
		["🗝️", MailFlag.HasRustyKey, "Rusty Key"],
		["🃏", MailFlag.HasClubCard, "Club Card"],
		["🍀", MailFlag.HasSpecialCharm, "Special Charm"],
		["💀", MailFlag.HasSkullKey, "Skull Key"],
		["🔍", MailFlag.HasMagnifyingGlass, "Magnifying Glass"],
		["🌑", MailFlag.HasDarkTalisman, "Dark Talisman"],
		["🖋️", MailFlag.HasMagicInk, "Magic Ink"],
		["🏘️", MailFlag.HasTownKey, "Town Key"],
	] satisfies [string, MailFlag, string][];

	const skills = new Map<Skill, string>([
		[Skill.Farming, "Farming 🥕"],
		[Skill.Mining, "Mining ⛏️"],
		[Skill.Foraging, "Foraging 🌳"],
		[Skill.Fishing, "Fishing 🎣"],
		[Skill.Combat, "Combat ⚔️"],
	]);

	const backpacks: Record<number, string> = {
		12: "12 slots",
		24: "24 slots (Large Pack)",
		36: "36 slots (Deluxe Pack)",
	};

	const houses = ["Starting house", "Kitchen", "Nursery", "Cellar"];
	// While Robin is at work, 0 days would stop the upgrade rather than finish
	// it, so the days only go down to 1 and a button stops it
	const houseUpgrading = $derived(save.player.daysUntilHouseUpgrade > 0);
	const nextHouse = $derived(
		houses[save.player.houseUpgradeLevel + 1]?.toLowerCase(),
	);

	const trashCans = [
		"Basic",
		"Copper (15% back)",
		"Steel (30% back)",
		"Gold (45% back)",
		"Iridium (60% back)",
	];
</script>

<UiContainer>
	<h3>Skills</h3>
	<div class="wrapper">
		{#each skills as [key, label]}
			<label for={`skills-${key}`}>
				{label}
				<SkillBar bind:skill={save.player.skills.experience[key]} />
				<UiInput
					id={`skills-${key}`}
					type="number"
					min="0"
					max="99999"
					bind:value={save.player.skills.experience[key]}
					data-testid={`skills-${key}`}
				/>
			</label>
		{/each}
		<label for="skills-mastery">
			Mastery ✨
			<span class="mastery-level" data-testid="mastery-level"
				>Level {masteryLevel(save.player.masteryExp)}/5</span
			>
			<UiInput
				id="skills-mastery"
				type="number"
				min={masteryXpForLevel[save.player.masteryLevelsSpent]}
				bind:value={() => save.player.masteryExp,
				(v) => {
					// Cleared while typing: wait for a number
					if (v === null) return;
					save.player.masteryExp = Number(v);
				}}
				data-testid="skills-mastery"
			/>
		</label>
		<small class="mastery-hint" data-testid="mastery-hint"
			>Earned once every skill is level 10. Each level ({masteryXpForLevel
				.slice(1)
				.map((xp) => xp.toLocaleString("en-US"))
				.join(", ")} XP) claims a mastery in the Mastery Cave.{save.player
				.masteryLevelsSpent
				? ` Can't go below the cost of the ${save.player.masteryLevelsSpent} claimed.`
				: ""}</small
		>
	</div>

	<h3>Professions</h3>

	<Professions professions={save.player.professions} />

	<h3>Stats</h3>

	<div class="stats">
		<label>
			Health ❤️
			<UiInput
				type="number"
				min="0"
				max="99999"
				bind:value={save.player.maxHealth}
			/>
		</label>
		<label>
			Stamina ⚡
			<UiInput
				type="number"
				min="0"
				max="99999"
				bind:value={save.player.maxStamina}
			/>
		</label>
		<label>
			Qi Gems 💎
			<UiInput
				type="number"
				min="0"
				max="99999"
				bind:value={save.player.qiGems}
			/>
		</label>
		<label>
			Qi Coins 💰
			<UiInput
				type="number"
				min="0"
				max="99999"
				bind:value={save.player.clubCoins}
			/>
		</label>
		<label>
			Hay 🌾
			<UiInput
				type="number"
				min="0"
				max="99999"
				bind:value={farm.piecesOfHay}
			/>
		</label>
		<label>
			Golden Walnuts 🌰
			<UiInput
				type="number"
				min="0"
				max="99999"
				bind:value={save.goldenWalnuts}
			/>
		</label>
		<div>
			<label>
				Deepest Mine ⛏️
				<UiInput
					type="number"
					min="0"
					max="77376"
					bind:value={save.deepestMineLevel}
				/>
				<!-- 77377 is the quarry level -->
			</label>
			<small>1-120 (The Mines), 121- (Skull Cavern)</small>
		</div>
	</div>

	<h3>Upgrades</h3>

	<div class="stats upgrades">
		<div>
			<label>
				Backpack 🎒
				{#if BACKPACK_SIZES.includes(save.player.maxItems)}
					<UiSelect
						value={save.player.maxItems}
						onchange={(e) =>
							save.player.setBackpackSize(Number(e.currentTarget.value))}
						data-testid="backpack-size"
					>
						{#each BACKPACK_SIZES as size}
							<option
								value={size}
								disabled={!save.player.canResizeBackpack(size)}
								>{backpacks[size]}</option
							>
						{/each}
					</UiSelect>
				{:else}
					<span data-testid="backpack-size">{save.player.maxItems} slots</span>
				{/if}
			</label>
			<small
				>To make it smaller, empty its last slots on the Inventory page.</small
			>
		</div>
		<div>
			<label>
				House 🏡
				<UiInput
					type="number"
					min={houseUpgrading ? 1 : 0}
					max={HOUSE_UPGRADE_DAYS}
					disabled={save.player.houseUpgradeLevel >= MAX_HOUSE_UPGRADE_LEVEL}
					bind:value={() => Math.max(0, save.player.daysUntilHouseUpgrade),
					(v) => {
						// Cleared while typing: wait for a number
						if (v === null) return;
						save.player.daysUntilHouseUpgrade = Number(v);
					}}
					data-testid="house-upgrade-days"
				/>
			</label>
			<small data-testid="house-upgrade-hint">
				{#if save.player.houseUpgradeLevel >= MAX_HOUSE_UPGRADE_LEVEL}
					Fully upgraded ({houses[MAX_HOUSE_UPGRADE_LEVEL]}).
				{:else if houseUpgrading}
					Now: {houses[save.player.houseUpgradeLevel]}. Days until Robin
					finishes the {nextHouse}: 1 is after the next sleep (the game moves
					the furniture). Cancelling doesn't give back what she was paid. A
					farmhand's only counts down on nights they play.
				{:else}
					Now: {houses[save.player.houseUpgradeLevel]}. Days until Robin adds
					the {nextHouse}: 1 is after the next sleep (the game moves the
					furniture), 0 is none. A farmhand's only counts down on nights they
					play.
				{/if}
			</small>
			{#if houseUpgrading}
				<button
					type="button"
					class="cancel"
					onclick={() => (save.player.daysUntilHouseUpgrade = -1)}
					data-testid="house-upgrade-cancel"
				>
					Cancel upgrade
				</button>
			{/if}
		</div>
		<div>
			<label>
				Trash Can 🗑️
				<UiSelect
					value={save.player.trashCanLevel}
					onchange={(e) =>
						(save.player.trashCanLevel = Number(e.currentTarget.value))}
					disabled={save.player.trashCanAtClint}
					data-testid="trash-can-level"
				>
					{#each trashCans as name, level}
						<option value={level}>{name}</option>
					{/each}
				</UiSelect>
			</label>
			<small
				>{save.player.trashCanAtClint
					? "Clint is upgrading it; collect it from him first."
					: "Trashing an item gets back this much of its price."}</small
			>
		</div>
		{#if save.player.toolBeingUpgraded}
			<div>
				<label>
					Clint: {ItemNameHelper(save.player.toolBeingUpgraded)} 🔨
					<UiInput
						type="number"
						min="0"
						max={TOOL_UPGRADE_DAYS}
						bind:value={() => save.player.daysLeftForToolUpgrade,
						(v) => {
							// Cleared while typing: wait for a number
							if (v === null) return;
							save.player.daysLeftForToolUpgrade = Number(v);
						}}
						data-testid="tool-upgrade-days"
					/>
				</label>
				<small>Days until it's ready to collect; 0 means it's ready now.</small>
			</div>
		{/if}
	</div>

	<h3>Wallet</h3>

	<div class="wallet-wrapper">
		<UiContainerSmall>
			<div class="wallet">
				{#each unlocks as [emoji, flag, alt]}
					<WalletItem {alt} {mail} {flag}>
						{emoji}
					</WalletItem>
				{/each}
			</div>
		</UiContainerSmall>
	</div>
</UiContainer>

<style>
	.wrapper {
		display: flex;
		flex-direction: column;
		font-weight: bold;
	}

	.wrapper > label {
		display: flex;
		flex-direction: row;
		justify-content: end;
		align-items: center;
		margin: 16px 0;
		gap: 4px;
		white-space: nowrap;
	}

	.mastery-level {
		font-weight: normal;
		margin: 0 8px;
	}

	.mastery-hint {
		font-size: x-small;
		font-weight: normal;
		text-align: right;
		margin-top: -12px;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
		font-weight: bold;
		padding: 16px;
		padding-top: 8px;
	}

	.stats label {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
	}

	.stats small {
		font-size: x-small;
		margin-top: 4px;
	}

	.upgrades {
		grid-template-columns: 1fr;
	}

	.upgrades label {
		gap: 8px;
		white-space: nowrap;
	}

	.upgrades label :global(.select-wrapper) {
		width: 13rem;
	}

	.upgrades small {
		display: block;
		font-weight: normal;
	}

	.upgrades .cancel {
		margin-top: 4px;
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid #5b2b2a;
		background: none;
		color: inherit;
		font-family: inherit;
		font-size: x-small;
		font-weight: bold;
		cursor: pointer;
	}

	.upgrades .cancel:hover {
		background-color: #5b2b2a;
		color: #f9bb65;
	}

	.wallet {
		margin: 0;
		margin-top: 8px;
		padding: 6px;
		border-radius: 1px;
		display: flex;
		justify-content: space-evenly;
		align-items: center;
	}

	.wallet-wrapper {
		display: flex;
		justify-content: center;
	}
</style>
