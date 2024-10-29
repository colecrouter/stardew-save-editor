<script lang="ts">
    import { saveManager } from "$lib/SaveFile.svelte";
    import { tooltip } from "$lib/Tooltip";
    import type { Player, Save } from "$types/save/1.6";
    import Container from "../../Container.svelte";
    import SkillBar from "./SkillBar.svelte";
    import WalletItem from "./WalletItem.svelte";

    if (!saveManager.player || !saveManager.farm || !saveManager.saveData)
        throw new Error("No player data found");

    const unlocks = [
        ["📙", "canUnderstandDwarves", "Dwarvish Translation Guide"],
        ["🗝️", "hasRustyKey", "Rusty Key"],
        ["🃏", "hasClubCard", "Club Card"],
        ["🍀", "hasSpecialCharm", "Special Charm"],
        ["💀", "hasSkullKey", "Skull Key"],
        ["🔍", "hasMagnifyingGlass", "Magnifying Glass"],
        ["🌑", "hasDarkTalisman", "Dark Talisman"],
        ["🖋️", "hasMagicInk", "Magic Ink"],
        ["🏘️", "HasTownKey", "Town Key"],
    ] satisfies [string, keyof Player, string][];

    function updateUnlock(key: keyof Player, value: boolean) {
        if (saveManager.player) {
            // @ts-ignore
            saveManager.player[key] = value ? "" : undefined;
        }
    }

    const skills = [
        "Farming 🥕",
        "Mining ⛏️",
        "Foraging 🌳",
        "Fishing 🎣",
        "Combat ⚔️",
    ];

    type S = typeof saveManager;
    type Stat = {
        [T in keyof S]: NonNullable<S[T]> extends object
            ? {
                  [U in keyof NonNullable<S[T]>]: [string, T, U];
              }[keyof NonNullable<S[T]>]
            : never;
    }[keyof S];
    const stats = [
        ["Health ❤️", "player", "maxHealth"],
        ["Stamina ⚡", "player", "maxStamina"],
        ["Qi Gems 💎", "player", "qiGems"],
        ["Qi Coins 💰", "player", "clubCoins"],
        ["Hay 🌾", "farm", "piecesOfHay"],
        ["Golden Walnuts 🌰", "saveData", "goldenWalnuts"],
    ] satisfies Stat[];

    function updateStat(
        firstKey: keyof S,
        secondKey: keyof NonNullable<S[typeof firstKey]>,
        value: number,
    ) {
        if (saveManager[firstKey]) {
            // @ts-ignore
            saveManager[firstKey][secondKey] = value;
        }
    }
</script>

{#if saveManager.player && saveManager.farm}
    {@const player = saveManager.player}
    <Container>
        <h3>Skills</h3>
        <div class="wrapper">
            {#each player.experiencePoints.int as skill, i}
                {#if skills[i] !== undefined}
                    <label for={`skills-${i}`}>
                        {skills[i]}
                        <SkillBar bind:skill={player.experiencePoints.int[i]} />
                        <input
                            id={`skills-${i}`}
                            type="number"
                            min="0"
                            max="99999"
                            bind:value={player.experiencePoints.int[i]}
                        />
                    </label>
                {/if}
            {/each}
        </div>

        <h3>Stats</h3>

        <div class="stats">
            {#each stats as [label, key1, key2]}
                <label>
                    {label}
                    <input
                        type="number"
                        min="0"
                        max="99999"
                        bind:value={saveManager[key1 as never][key2]}
                    />
                    <!-- Why does this work ^ ???? -->
                </label>
            {/each}
        </div>

        <h3>Wallet</h3>

        <div class="wallet">
            {#each unlocks as [emoji, key, alt]}
                <div aria-label={alt} use:tooltip>
                    <WalletItem
                        value={player[key] === ""}
                        onclick={(v: boolean) => updateUnlock(key, v)}
                    >
                        {emoji}
                    </WalletItem>
                </div>
            {/each}
        </div>
    </Container>
{/if}

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

    input[type="number"] {
        width: 4em;
    }

    input[type="number"]::-webkit-inner-spin-button {
        appearance: none;
    }

    .wallet {
        box-shadow:
            0 0 0 2px #b14e05,
            0 0 0 4px #dc7b05,
            0 0 0 6px #5b2b29;
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
