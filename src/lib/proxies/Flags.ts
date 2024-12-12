import type { Player } from "$types/save";

const nil = { "@_xsi:nil": "true" } as const;

export class Flags {
    raw: Player;

    constructor(player: Player) {
        this.raw = player;
    }

    get canUnderstandDwarves() {
        return this.raw?.canUnderstandDwarves === "";
    }

    set canUnderstandDwarves(value) {
        // @ts-expect-error
        this.raw.canUnderstandDwarves = value ? "" : nil;
    }

    get hasRustyKey() {
        return this.raw?.hasRustyKey === "";
    }

    set hasRustyKey(value) {
        // @ts-expect-error
        this.raw.hasRustyKey = value ? "" : nil;
    }

    get hasClubCard() {
        return this.raw?.hasClubCard === "";
    }

    set hasClubCard(value) {
        // @ts-expect-error
        this.raw.hasClubCard = value ? "" : nil;
    }

    get hasSpecialCharm() {
        return this.raw?.hasSpecialCharm === "";
    }

    set hasSpecialCharm(value) {
        // @ts-expect-error
        this.raw.hasSpecialCharm = value ? "" : nil;
    }

    get hasSkullKey() {
        return this.raw?.hasSkullKey === "";
    }

    set hasSkullKey(value) {
        // @ts-expect-error
        this.raw.hasSkullKey = value ? "" : nil;
    }

    get hasMagnifyingGlass() {
        return this.raw?.hasMagnifyingGlass === "";
    }

    set hasMagnifyingGlass(value) {
        // @ts-expect-error
        this.raw.hasMagnifyingGlass = value ? "" : nil;
    }

    get hasDarkTalisman() {
        return this.raw?.hasDarkTalisman === "";
    }

    set hasDarkTalisman(value) {
        // @ts-expect-error
        this.raw.hasDarkTalisman = value ? "" : nil;
    }

    get hasMagicInk() {
        return this.raw?.hasMagicInk === "";
    }

    set hasMagicInk(value) {
        // @ts-expect-error
        this.raw.hasMagicInk = value ? "" : nil;
    }

    get HasTownKey() {
        return this.raw?.HasTownKey === "";
    }

    set HasTownKey(value) {
        // @ts-expect-error
        this.raw.HasTownKey = value ? "" : nil;
    }
}
