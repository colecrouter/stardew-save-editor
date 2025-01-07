<script lang="ts">
    import { getSaveManager } from "$lib/SaveManager.svelte";
    import type { Farmer } from "$lib/proxies/Farmer";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
    import UiInput from "$lib/ui/UIInput.svelte";
    import SkillBar from "./SkillBar.svelte";
    import WalletItem from "./WalletItem.svelte";

    const save = getSaveManager().save;
    const player = save?.player;
    const farm = save?.farm;
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
</script>

<UiContainer>
    <h3>Skills</h3>
    <div class="wrapper">
        {#each skills as [label, key]}
            <label for={`skills-${key}`}>
                {label}
                <SkillBar bind:skill={save.player.skills[key]} />
                <UiInput
                    id={`skills-${key}`}
                    type="number"
                    min="0"
                    max="99999"
                    bind:value={save.player.skills[key]}
                    data-testid={`skills-${key}`}
                />
            </label>
        {/each}
    </div>

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
                {#each unlocks as [emoji, key, alt]}
                    <WalletItem {alt} bind:value={save.player.flags[key]}>
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
