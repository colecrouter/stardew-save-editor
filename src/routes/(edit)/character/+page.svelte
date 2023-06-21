<script lang="ts">
    import { SaveGame } from '$lib/Upload';
    import type { GameLocation, Player, Save } from '../../../types/save/1.5.6';
    import Container from '../../Container.svelte';
    import SkillBar from './SkillBar.svelte';
    import WalletItem from './WalletItem.svelte';

    let save: Save;
    let player: Player;
    let skillValues: number[];

    let hasTranslation: boolean;
    let hasRustyKey: boolean;
    let hasClubCard: boolean;
    let hasSpecialCharm: boolean;
    let hasSkullKey: boolean;
    let hasMagnifyingGlass: boolean;
    let hasDarkTalisman: boolean;
    let hasMagicInk: boolean;
    let hasTownKey: boolean;

    let farm: GameLocation;
    SaveGame.subscribe((s) => {
        if (!s) return;
        save = s.SaveGame;
        player = s.SaveGame.player;
        farm = s.SaveGame.locations.GameLocation.find((l) => l.name === 'Farm')!;
        skillValues = player.experiencePoints.int.slice(0, 5);

        hasTranslation = player.canUnderstandDwarves;
        hasRustyKey = player.hasRustyKey;
        hasClubCard = player.hasClubCard;
        hasSpecialCharm = player.hasSpecialCharm;
        hasSkullKey = player.hasSkullKey;
        hasMagnifyingGlass = player.hasMagnifyingGlass;
        hasDarkTalisman = player.hasDarkTalisman;
        hasMagicInk = player.hasMagicInk;
        hasTownKey = player.HasTownKey;
    });

    const skills = ['Farming 🥕', 'Mining ⛏️', 'Foraging 🌳', 'Fishing 🎣', 'Combat ⚔️'];

    $: {
        if (!player) break $;
        for (let i = 0; i < skillValues.length; i++) {
            player.experiencePoints.int[i] = skillValues[i];
        }
    }

    $: player.canUnderstandDwarves = hasTranslation;
    $: player.hasRustyKey = hasRustyKey;
    $: player.hasClubCard = hasClubCard;
    $: player.hasSpecialCharm = hasSpecialCharm;
    $: player.hasSkullKey = hasSkullKey;
    $: player.hasMagnifyingGlass = hasMagnifyingGlass;
    $: player.hasDarkTalisman = hasDarkTalisman;
    $: player.hasMagicInk = hasMagicInk;
    $: player.HasTownKey = hasTownKey;
</script>

<Container>
    <h3>Skills</h3>

    <div class="wrapper">
        {#each skillValues as skill, i}
            <label>
                {skills[i]}
                <SkillBar bind:skill />
                <input type="number" min="0" max="99999" bind:value={skill} />
            </label>
        {/each}
    </div>

    <h3>Stats</h3>

    <div class="stats">
        <label>
            Health
            <input type="number" min="0" max="99999" bind:value={player.maxHealth} />
        </label>
        <label>
            Stamina
            <input type="number" min="0" max="99999" bind:value={player.maxStamina} />
        </label>
        <label>
            Qi Gems
            <input type="number" min="0" max="99999" bind:value={player.qiGems} />
        </label>
        <label>
            Qi Coins
            <input type="number" min="0" max="99999" bind:value={player.clubCoins} />
        </label>
        <label>
            Hay
            <input type="number" min="0" max="99999" bind:value={farm.piecesOfHay} />
        </label>
        <label>
            Golden Walnuts
            <input type="number" min="0" max="130" bind:value={save.goldenWalnuts} />
        </label>
        <label>
            Favorite Thing
            <input type="text" bind:value={player.favoriteThing} />
        </label>
    </div>

    <h3>Wallet</h3>

    <div class="wallet">
        <WalletItem bind:value={hasTranslation}>📙</WalletItem>
        <WalletItem bind:value={hasRustyKey}>🗝️</WalletItem>
        <WalletItem bind:value={hasClubCard}>🃏</WalletItem>
        <WalletItem bind:value={hasSpecialCharm}>🍀</WalletItem>
        <WalletItem bind:value={hasSkullKey}>💀</WalletItem>
        <WalletItem bind:value={hasMagnifyingGlass}>🔍</WalletItem>
        <WalletItem bind:value={hasDarkTalisman}>🌑</WalletItem>
        <WalletItem bind:value={hasMagicInk}>🖋️</WalletItem>
        <WalletItem bind:value={hasTownKey}>🏘️</WalletItem>
    </div>
</Container>

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

    .stats > label {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }

    .stats > label:last-child {
        grid-column: 1 / -1;
    }

    input[type='number'] {
        width: 4em;
    }

    input[type='number']::-webkit-inner-spin-button {
        appearance: none;
    }

    .wallet {
        box-shadow: 0 0 0 2px #b14e05, 0 0 0 4px #dc7b05, 0 0 0 6px #5b2b29;
        margin: 0;
        margin-top: 24px;
        padding: 6px;
        border-radius: 1px;
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        align-items: center;
    }
</style>
