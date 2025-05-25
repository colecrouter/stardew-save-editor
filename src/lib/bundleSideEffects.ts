import type { GameLocation } from "$lib/proxies/GameLocation";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import { MailFlag } from "$lib/proxies/mail";
import type { BoolArray, BoolContainer, IntContainer, KV } from "$types/save";
import { SvelteSet } from "svelte/reactivity";

/*
    This file is responsible for managing the side effects of completing a bundle in the Community Center.

    When a bundle is completed/uncompleted, two things need to happen:
    - The room needs to be marked as finished/unfinised (in-game cosmetic change)
    - A side effect needs to occur (e.g. bus stop repair)
*/

// Helpers

export enum CCRoom {
    Pantry = 0,
    CraftsRoom = 1,
    FishTank = 2,
    BoilerRoom = 3,
    Vault = 4,
    BulletinBoard = 5,
    AbandonedJojaMart = 6,
}

type SideEffect = (s: SaveProxy, cc: GameLocation) => void;

type SideEffectPair = {
    add: SideEffect;
    remove: SideEffect;
};

const updateRoom = (cc: GameLocation, room: CCRoom, completed: boolean) => {
    // Initialize the room if it doesn't exist (not sure if this is necessary)
    if (!cc.raw.areasComplete)
        cc.raw.areasComplete = { boolean: new Array(7).fill(false) };

    // If there aren't 7 entries, add them and fill with false
    const roomCount = cc.raw.areasComplete.boolean.length;
    if (roomCount < 7)
        cc.raw.areasComplete.boolean.push(
            ...new Array(7 - roomCount).fill(false),
        );

    // Update the room
    cc.raw.areasComplete.boolean[room] = completed;
};

// Side Effects

const pantry = {
    add: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            // CC flag
            player.mailReceived = player.mailReceived.add(MailFlag.ccPantry);
            // Joja‐member flag
            if (player.mailReceived.has(MailFlag.JojaMember)) {
                player.mailReceived = player.mailReceived.add(
                    MailFlag.jojaPantry,
                );
            }
        }
        updateRoom(cc, CCRoom.Pantry, true);
    },
    remove: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            const updated = new SvelteSet(player.mailReceived);
            player.mailReceived.delete(MailFlag.ccPantry);
            player.mailReceived.delete(MailFlag.jojaPantry);
        }
        updateRoom(cc, CCRoom.Pantry, false);
    },
} satisfies SideEffectPair;

const craftsRoom = {
    add: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            player.mailReceived = player.mailReceived.add(
                MailFlag.ccCraftsRoom,
            );
            if (player.mailReceived.has(MailFlag.JojaMember)) {
                player.mailReceived = player.mailReceived.add(
                    MailFlag.jojaCraftsRoom,
                );
            }
        }
        updateRoom(cc, CCRoom.CraftsRoom, true);
    },
    remove: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            const updated = new SvelteSet(player.mailReceived);
            updated.delete(MailFlag.ccCraftsRoom);
            updated.delete(MailFlag.jojaCraftsRoom);
            player.mailReceived = updated;
        }
        updateRoom(cc, CCRoom.CraftsRoom, false);
    },
} satisfies SideEffectPair;

const fishTank = {
    add: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            player.mailReceived = player.mailReceived.add(MailFlag.ccFishTank);
            if (player.mailReceived.has(MailFlag.JojaMember)) {
                player.mailReceived = player.mailReceived.add(
                    MailFlag.jojaFishTank,
                );
            }
        }
        updateRoom(cc, CCRoom.FishTank, true);
    },
    remove: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            const updated = new SvelteSet(player.mailReceived);
            updated.delete(MailFlag.ccFishTank);
            updated.delete(MailFlag.jojaFishTank);
            player.mailReceived = updated;
        }
        updateRoom(cc, CCRoom.FishTank, false);
    },
} satisfies SideEffectPair;

const boilerRoom = {
    add: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            player.mailReceived = player.mailReceived.add(
                MailFlag.ccBoilerRoom,
            );
            if (player.mailReceived.has(MailFlag.JojaMember)) {
                player.mailReceived = player.mailReceived.add(
                    MailFlag.jojaBoilerRoom,
                );
            }
        }
        updateRoom(cc, CCRoom.BoilerRoom, true);
    },
    remove: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            const updated = new SvelteSet(player.mailReceived);
            updated.delete(MailFlag.ccBoilerRoom);
            updated.delete(MailFlag.jojaBoilerRoom);
            player.mailReceived = updated;
        }
        updateRoom(cc, CCRoom.BoilerRoom, false);
    },
} satisfies SideEffectPair;

const vault = {
    add: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            player.mailReceived = player.mailReceived.add(MailFlag.ccVault);
            if (player.mailReceived.has(MailFlag.JojaMember)) {
                player.mailReceived = player.mailReceived.add(
                    MailFlag.jojaVault,
                );
            }
        }
        updateRoom(cc, CCRoom.Vault, true);
    },
    remove: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            const updated = new SvelteSet(player.mailReceived);
            updated.delete(MailFlag.ccVault);
            updated.delete(MailFlag.jojaVault);
            player.mailReceived = updated;
        }
        updateRoom(cc, CCRoom.Vault, false);
    },
} satisfies SideEffectPair;

const bulletinBoard = {
    add: (s: SaveProxy, cc: GameLocation) => {
        // TODO
        for (const player of s.players) {
            player.mailReceived = player.mailReceived.add(MailFlag.ccBulletin);
        }
        updateRoom(cc, CCRoom.BulletinBoard, true);
    },
    remove: (s: SaveProxy, cc: GameLocation) => {
        // TODO
        for (const player of s.players) {
            const updated = new SvelteSet(player.mailReceived);
            updated.delete(MailFlag.ccBulletin);
            player.mailReceived = updated;
        }
        updateRoom(cc, CCRoom.BulletinBoard, false);
    },
} satisfies SideEffectPair;

const abandonedJojaMart = {
    add: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            player.mailReceived = player.mailReceived.add(
                MailFlag.ccMovieTheater,
            );
            // Joja movie‐theater flag
            if (player.mailReceived.has(MailFlag.JojaMember)) {
                player.mailReceived = player.mailReceived.add(
                    MailFlag.ccMovieTheaterJoja,
                );
            }
        }
        updateRoom(cc, CCRoom.AbandonedJojaMart, true);
    },
    remove: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            const updated = new SvelteSet(player.mailReceived);
            updated.delete(MailFlag.ccMovieTheater);
            updated.delete(MailFlag.ccMovieTheaterJoja);
            player.mailReceived = updated;
        }
        updateRoom(cc, CCRoom.AbandonedJojaMart, false);
    },
} satisfies SideEffectPair;

const all = {
    add: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            player.mailReceived = player.mailReceived.add(
                MailFlag.ccIsComplete,
            );
            player.mailReceived = player.mailReceived.add(
                MailFlag.abandonedJojaMartAccessible,
            );
        }
    },
    remove: (s: SaveProxy, cc: GameLocation) => {
        for (const player of s.players) {
            const updated = new SvelteSet(player.mailReceived);
            updated.delete(MailFlag.ccIsComplete);
            updated.delete(MailFlag.abandonedJojaMartAccessible);
            player.mailReceived = updated;
        }
    },
};

export const bundleSideEffects = Object.freeze(
    new Map<CCRoom | null, SideEffectPair>([
        [CCRoom.Pantry, pantry],
        [CCRoom.CraftsRoom, craftsRoom],
        [CCRoom.FishTank, fishTank],
        [CCRoom.BoilerRoom, boilerRoom],
        [CCRoom.Vault, vault],
        [CCRoom.BulletinBoard, bulletinBoard],
        [CCRoom.AbandonedJojaMart, abandonedJojaMart],
        [null, all],
    ]),
);
