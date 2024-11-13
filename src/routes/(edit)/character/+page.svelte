<script lang="ts">
    import type { Farmer } from "$lib/proxies/Farmer";
    import { saveManager } from "$lib/save.svelte";
    import { tooltip } from "$lib/Tooltip";
    import Container from "../../Container.svelte";
    import SkillBar from "./SkillBar.svelte";
    import WalletItem from "./WalletItem.svelte";

    const player = saveManager.save?.player;
    const farm = saveManager.save?.farm;
    const save = saveManager.save;
    if (!player || !farm || !save) throw new Error("No player data found");

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
    ] satisfies [string, keyof Farmer["flags"], string][];

    const skills = [
        ["Farming 🥕", "farming"],
        ["Mining ⛏️", "mining"],
        ["Foraging 🌳", "foraging"],
        ["Fishing 🎣", "fishing"],
        ["Combat ⚔️", "combat"],
    ] satisfies [string, keyof Farmer["skills"]][];

    // TODO gotta be a better way to do this
    const stats = [
        ["Health ❤️", player, "maxHealth"],
        ["Stamina ⚡", player, "maxStamina"],
        ["Qi Gems 💎", player, "qiGems"],
        ["Qi Coins 💰", player, "clubCoins"],
        ["Hay 🌾", farm, "piecesOfHay"],
        ["Golden Walnuts 🌰", save, "goldenWalnuts"],
        // biome-ignore lint/suspicious/noExplicitAny: todo
    ] as [string, any, keyof any][];
</script>

<Container>
    <h3>Skills</h3>
    <div class="wrapper">
        {#each skills as [label, key]}
            <label for={`skills-${key}`}>
                {label}
                <SkillBar bind:skill={player.skills[key]} />
                <input
                    id={`skills-${key}`}
                    type="number"
                    min="0"
                    max="99999"
                    bind:value={player.skills[key]}
                />
            </label>
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
                    bind:value={key1[key2]}
                />
            </label>
        {/each}
    </div>

    <h3>Wallet</h3>

    <div class="wallet">
        {#each unlocks as [emoji, key, alt]}
            <div aria-label={alt} use:tooltip>
                <WalletItem bind:value={player.flags[key]}>
                    {emoji}
                </WalletItem>
            </div>
        {/each}
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
