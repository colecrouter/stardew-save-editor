import type { GameLocation } from "$lib/proxies/GameLocation.svelte";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import type { BoolArray, BoolContainer, IntContainer, KV } from "$types/save";
import { Raw } from "./proxies";

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
	if (!cc[Raw].areasComplete)
		cc[Raw].areasComplete = { boolean: new Array(7).fill(false) };

	// If there aren't 7 entries, add them and fill with false
	const roomCount = cc[Raw].areasComplete.boolean.length;
	if (roomCount < 7)
		cc[Raw].areasComplete.boolean.push(...new Array(7 - roomCount).fill(false));

	// Update the room
	cc[Raw].areasComplete.boolean[room] = completed;
};

function applyMail(
	s: SaveProxy,
	transform: (mail: Set<MailFlag>) => Set<MailFlag>,
) {
	for (const player of s.players) {
		player.mailReceived = transform(player.mailReceived);
	}
}

// new factory: given a primary mail flag, optional joja‐flag & room, produce a SideEffectPair
function makeEffect(
	mainFlag: MailFlag,
	jojaFlag?: MailFlag,
	room?: CCRoom,
): SideEffectPair {
	return {
		add: (s, cc) => {
			applyMail(s, (mail) => {
				mail.add(mainFlag);
				if (jojaFlag) {
					if (mail.has(MailFlag.JojaMember)) mail.add(jojaFlag);
					else mail.delete(jojaFlag);
				}
				return mail;
			});
			if (room !== undefined) updateRoom(cc, room, true);
		},
		remove: (s, cc) => {
			applyMail(s, (mail) => {
				mail.delete(mainFlag);
				if (jojaFlag) mail.delete(jojaFlag);
				return mail;
			});
			if (room !== undefined) updateRoom(cc, room, false);
		},
	};
}

export const bundleSideEffects = Object.freeze(
	new Map<CCRoom | null, SideEffectPair>([
		[
			CCRoom.Pantry,
			makeEffect(MailFlag.ccPantry, MailFlag.jojaPantry, CCRoom.Pantry),
		],
		[
			CCRoom.CraftsRoom,
			makeEffect(
				MailFlag.ccCraftsRoom,
				MailFlag.jojaCraftsRoom,
				CCRoom.CraftsRoom,
			),
		],
		[
			CCRoom.FishTank,
			makeEffect(MailFlag.ccFishTank, MailFlag.jojaFishTank, CCRoom.FishTank),
		],
		[
			CCRoom.BoilerRoom,
			makeEffect(
				MailFlag.ccBoilerRoom,
				MailFlag.jojaBoilerRoom,
				CCRoom.BoilerRoom,
			),
		],
		[
			CCRoom.Vault,
			makeEffect(MailFlag.ccVault, MailFlag.jojaVault, CCRoom.Vault),
		],
		[
			CCRoom.BulletinBoard,
			makeEffect(MailFlag.ccBulletin, undefined, CCRoom.BulletinBoard),
		],
		[
			CCRoom.AbandonedJojaMart,
			makeEffect(
				MailFlag.ccMovieTheater,
				MailFlag.ccMovieTheaterJoja,
				CCRoom.AbandonedJojaMart,
			),
		],
		[
			null,
			makeEffect(MailFlag.ccIsComplete, MailFlag.abandonedJojaMartAccessible),
		],
	]),
);
