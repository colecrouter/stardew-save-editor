<script lang="ts">
    import { Character, SaveGame } from '$lib/SaveFile';
    import { tooltip } from '$lib/Tooltip';
    import type { GameLocation, Player, Save } from '../../../types/save/1.5';
    import Container from '../../Container.svelte';
    import SkillBar from './SkillBar.svelte';
    import WalletItem from './WalletItem.svelte';

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

    Character.character.subscribe((c) => {
        if (!c) return;
        player = c;

        hasTranslation = c.canUnderstandDwarves;
        hasRustyKey = c.hasRustyKey;
        hasClubCard = c.hasClubCard;
        hasSpecialCharm = c.hasSpecialCharm;
        hasSkullKey = c.hasSkullKey;
        hasMagnifyingGlass = c.hasMagnifyingGlass;
        hasDarkTalisman = c.hasDarkTalisman;
        hasMagicInk = c.hasMagicInk;
        hasTownKey = c.HasTownKey;

        skillValues = c.experiencePoints.int.slice(0, 5);
    });

    let save: Save;
    let farm: GameLocation;
    SaveGame.subscribe((s) => {
        if (!s) return;
        save = s.SaveGame;
        farm = s.SaveGame.locations.GameLocation.find((l) => l.name === 'Farm')!;
    });

    const skills = ['Farming 🥕', 'Mining ⛏️', 'Foraging 🌳', 'Fishing 🎣', 'Combat ⚔️'];

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
    </div>

    <h3>Wallet</h3>

    <div class="wallet">
        <div aria-label="Dwarvish Translation Guide" use:tooltip><WalletItem bind:value={hasTranslation}>📙</WalletItem></div>
        <div aria-label="Rusty Key" use:tooltip><WalletItem bind:value={hasRustyKey}>🗝️</WalletItem></div>
        <div aria-label="Club Card" use:tooltip><WalletItem bind:value={hasClubCard}>🃏</WalletItem></div>
        <div aria-label="Special Charm" use:tooltip><WalletItem bind:value={hasSpecialCharm}>🍀</WalletItem></div>
        <div aria-label="Skull Key" use:tooltip><WalletItem bind:value={hasSkullKey}>💀</WalletItem></div>
        <div aria-label="Magnifying Glass" use:tooltip><WalletItem bind:value={hasMagnifyingGlass}>🔍</WalletItem></div>
        <div aria-label="Dark Talisman" use:tooltip><WalletItem bind:value={hasDarkTalisman}>🌑</WalletItem></div>
        <div aria-label="Magic Ink" use:tooltip><WalletItem bind:value={hasMagicInk}>🖋️</WalletItem></div>
        <div aria-label="Town Key" use:tooltip><WalletItem bind:value={hasTownKey}>🏘️</WalletItem></div>
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

    /* .stats > label:last-child {
        grid-column: 1 / -1;
    } */

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
