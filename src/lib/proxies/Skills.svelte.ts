// [farming, mining, foraging, fishing, combat]

import type { Player } from "$types/save";

const xpForLevel = [
    0, 100, 380, 770, 1300, 2150, 3300, 4800, 6900, 10000, 15000,
] as const;

const xpToLevel = (xp: number) => {
    let level = 0;
    for (let i = 0; i < xpForLevel.length; i++) {
        const xpRequired = xpForLevel[i] ?? 0;
        if (xp < xpRequired) break;
        level = i;
    }
    return level;
};

export class Skills {
    raw: number[];
    player: Player;

    constructor(skills: number[], player: Player) {
        this.raw = skills;
        this.player = player;
    }

    get farming() {
        return this.raw[0] ?? 0;
    }

    set farming(value) {
        this.raw[0] = value;

        // Update level based on farming XP
        this.player.farmingLevel = xpToLevel(value);

        console.debug(
            "Farming skill updated:",
            value,
            "Level:",
            this.player.farmingLevel,
        );
    }

    get mining() {
        return this.raw[3] ?? 0;
    }

    set mining(value) {
        this.raw[3] = value;

        // Update level based on mining XP
        this.player.miningLevel = xpToLevel(value);

        console.debug(
            "Mining skill updated:",
            value,
            "Level:",
            this.player.miningLevel,
        );
    }

    get foraging() {
        return this.raw[2] ?? 0;
    }

    set foraging(value) {
        this.raw[2] = value;

        // Update level based on foraging XP
        this.player.foragingLevel = xpToLevel(value);

        console.debug(
            "Foraging skill updated:",
            value,
            "Level:",
            this.player.foragingLevel,
        );
    }

    get fishing() {
        return this.raw[1] ?? 0;
    }

    set fishing(value) {
        this.raw[1] = value;

        // Update level based on fishing XP
        this.player.fishingLevel = xpToLevel(value);

        console.debug(
            "Fishing skill updated:",
            value,
            "Level:",
            this.player.fishingLevel,
        );
    }

    get combat() {
        return this.raw[4] ?? 0;
    }

    set combat(value) {
        this.raw[4] = value;

        // Update level based on combat XP
        this.player.combatLevel = xpToLevel(value);

        console.debug(
            "Combat skill updated:",
            value,
            "Level:",
            this.player.combatLevel,
        );
    }
}
