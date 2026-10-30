import type { GameLocation } from "$lib/proxies/GameLocation.svelte";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
import { Raw } from "./proxies";

/*
	This file is responsible for managing the side effects of completing a bundle in the Community Center.

	When a bundle is completed/uncompleted, two things need to happen:
	- The room needs to be marked as finished/unfinised (in-game cosmetic change)
	- A side effect needs to occur (e.g. bus stop repair)
*/

// Helpers

import { CCRoom, communityRooms } from "./communityCenterData.ts";
export { CCRoom } from "./communityCenterData.ts";

type SideEffect = (s: SaveProxy, cc: GameLocation) => void;

type SideEffectPair = {
	add: SideEffect;
	remove: SideEffect;
};

const updateRoom = (cc: GameLocation, room: CCRoom, completed: boolean) => {
	// Initialize with the vanilla baseline of 6 rooms (Pantry..Bulletin).
	// Only expand to 7 when explicitly touching AbandonedJojaMart.
	if (!cc[Raw].areasComplete) {
		cc[Raw].areasComplete = { boolean: new Array(6).fill(false) };
	}

	const arr = cc[Raw].areasComplete.boolean;

	// Decide target length based on the room being updated
	const targetLength =
		room === CCRoom.AbandonedJojaMart ? 7 : Math.max(6, arr.length);
	if (arr.length < targetLength) {
		arr.push(...new Array(targetLength - arr.length).fill(false));
	}

	// Defensive guard: ignore invalid indices (shouldn't happen)
	if (room < 0) return;

	// Update the room flag
	arr[room] = completed;

	// Sanitize: never keep more than 7 entries; if the 7th (index 6) is false, omit it.
	if (arr.length > 7) {
		arr.splice(7); // drop anything beyond index 6
	}
	if (arr.length === 7 && arr[CCRoom.AbandonedJojaMart] === false) {
		arr.splice(6); // omit the 7th when it's false
	}
};

function applyMail(s: SaveProxy, transform: (mail: Set<MailFlag>) => void) {
	for (const player of s.players) {
		transform(player.mailReceived);
	}
}

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
			});
			if (room !== undefined) updateRoom(cc, room, true);
		},
		remove: (s, cc) => {
			applyMail(s, (mail) => {
				mail.delete(mainFlag);
				if (jojaFlag) mail.delete(jojaFlag);
			});
			if (room !== undefined) updateRoom(cc, room, false);
		},
	};
}

export const bundleSideEffects = Object.freeze(
	new Map<CCRoom | null, SideEffectPair>([
		// Keep legacy side effects and v2 domain projections on one room/flag map.
		...communityRooms.map(
			(room) =>
				[
					room.id,
					makeEffect(
						MailFlag[room.flag],
						"jojaFlag" in room ? MailFlag[room.jojaFlag] : undefined,
						room.id,
					),
				] as const,
		),

		[
			null,
			{
				// https://github.com/veywrn/StardewValley/blob/master/StardewValley/Locations/CommunityCenter.cs

				// Community Center overall completion. When the CC is completed via the vanilla route
				// (i.e., not a Joja Member), the Abandoned JojaMart becomes accessible after the storm.
				// We should NOT treat `abandonedJojaMartAccessible` as a Joja variant flag; instead,
				// ensure it is set only for non-Joja players and cleared otherwise.
				add: (s) => {
					applyMail(s, (mail) => {
						mail.add(MailFlag.ccIsComplete);
						mail.add(MailFlag.ccBulletinThankYou);
						// Make sure the player has seen the Junimo Note #83
						// Otherwise the Junimo will be forever trapped out-of-bounds
						mail.add(MailFlag.seenJunimoNote);
						if (mail.has(MailFlag.JojaMember)) {
							// Joja route does not unlock the Abandoned JojaMart via storm access
							mail.delete(MailFlag.abandonedJojaMartAccessible);
						} else {
							mail.add(MailFlag.abandonedJojaMartAccessible);
						}
					});
				},
				remove: (s) => {
					applyMail(s, (mail) => {
						mail.delete(MailFlag.ccIsComplete);
						mail.delete(MailFlag.ccBulletinThankYou);
						// If CC is not complete, access should be revoked regardless of route
						mail.delete(MailFlag.abandonedJojaMartAccessible);
					});
				},
			},
		],
	]),
);
