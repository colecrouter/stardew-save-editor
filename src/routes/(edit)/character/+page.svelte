<script lang="ts">
	import { MailFlag } from "$lib/proxies/Mail.svelte";
	import { Skill } from "$lib/proxies/Skills.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import Professions from "./Professions.svelte";
	import SkillBar from "./SkillBar.svelte";
	import WalletItem from "./WalletItem.svelte";

	const save = getSaveManager().save;
	const player = save?.player;
	const farm = save?.farm;
	if (!player || !farm || !save) throw new Error("No player data found");

	const mail = save.player.mailReceived;

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
