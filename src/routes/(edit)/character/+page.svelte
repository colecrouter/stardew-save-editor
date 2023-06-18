<script lang="ts">
    import { SaveGame } from '$lib/Upload';
    import type { Player } from '../../../types/save/1.5.6';
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

    SaveGame.subscribe((s) => {
        if (!s) return;
        player = s.SaveGame.player;
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
    <div class="wrapper">
        {#each skillValues as skill, i}
            <label class="inner">
                {skills[i]}
                <SkillBar bind:skill />
                <input type="number" min="0" max="99999" bind:value={skill} />
            </label>
        {/each}
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
        height: 20rem;
        font-weight: bold;
    }

    .inner {
        display: flex;
        flex-direction: row;
        justify-content: end;
        align-items: center;
        margin: 16px;
        gap: 4px;
        white-space: nowrap;
    }

    input[type='number'] {
        width: 4em;
    }

    input[type='number']::-webkit-inner-spin-button {
        appearance: none;
    }

    .wallet {
        box-shadow: 0 0 0 2px #b14e05, 0 0 0 4px #dc7b05, 0 0 0 6px #5b2b29;
        margin: 6px;
        padding: 6px;
        box-sizing: border-box;
        border-radius: 1px;
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        align-items: center;
    }
</style>
