import { communityRooms } from "../communityCenterData.ts";
import type { SaveDocument } from "./domain.ts";

export interface CommunityRequirementView {
	index: number;
	itemId: string;
	quantity: number;
	quality: number;
	submitted: boolean;
	currency: boolean;
}
export interface CommunityBundleView {
	key: string;
	id?: number;
	room?: number;
	name: string;
	/** Known vanilla seal colour; unknown colours use the UI fallback. */
	color?: number;
	supported: boolean;
	reason?: string;
	completed: boolean;
	needed: number;
	submitted: number;
	requirements: CommunityRequirementView[];
	reward?: { type: string; itemId: string; quantity: number };
	rewardAvailable: boolean;
	rewardSupported: boolean;
}
export interface CommunityView {
	supported: boolean;
	reason?: string;
	membership?: boolean;
	bundles: CommunityBundleView[];
	rooms: {
		id: number;
		name: string;
		unlock: string;
		note?: string;
		completed?: boolean;
		restored: boolean;
		project?: string;
		price?: number;
	}[];
	theater: boolean;
}
const nonnegative = (text: string | undefined) =>
	text !== undefined && /^\d+$/.test(text) && Number.isSafeInteger(Number(text))
		? Number(text)
		: undefined;
export function mailStrings(raw: unknown) {
	const entries = Array.isArray(raw) ? raw : [];
	const supported =
		(raw === undefined || raw === null || Array.isArray(raw)) &&
		entries.every((value) => typeof value === "string");
	return {
		raw,
		entries: entries.filter(
			(value): value is string => typeof value === "string",
		),
		supported,
	};
}
// The game’s standard reward decoder dereferences an item even when a type is
// unknown. Gate claimability to its known type tokens and signed 32-bit stacks.
const rewardKinds: Record<string, string> = {
	Furniture: "F",
	F: "F",
	Object: "O",
	O: "O",
	Ring: "R",
	R: "R",
	BigObject: "BO",
	BO: "BO",
	Boot: "B",
	B: "B",
	Weapon: "W",
	W: "W",
	Blueprint: "BL",
	BL: "BL",
	Hat: "H",
	H: "H",
	BigBlueprint: "BBL",
	BBl: "BBL",
	BBL: "BBL",
	C: "C",
};
/** Bounded definition parser: unfamiliar/malformed formats are visible, not rewritten by a permissive parseInt. */
function definition(key: string, value: string) {
	const split = key.split("/"),
		id = nonnegative(split[1]);
	const room = communityRooms.find((row) => row.key === split[0]);
	const parts = value.split("/"),
		tokens = parts[2]?.trim().split(/\s+/) ?? [];
	const requirements = [] as Omit<CommunityRequirementView, "submitted">[];
	let supported =
		split.length === 2 &&
		id !== undefined &&
		!!room &&
		!!parts[0] &&
		tokens.length > 0 &&
		tokens.length % 3 === 0;
	for (let index = 0; index < tokens.length; index += 3) {
		const itemId = tokens[index],
			quantity = nonnegative(tokens[index + 1]),
			quality = nonnegative(tokens[index + 2]);
		if (
			!itemId ||
			quantity === undefined ||
			quantity < 1 ||
			quality === undefined
		) {
			supported = false;
			continue;
		}
		requirements.push({
			index: index / 3,
			itemId,
			quantity,
			quality,
			currency: room?.id === 4 && /^-?\d+$/.test(itemId) && Number(itemId) <= 0,
		});
	}
	// Seal appearance is optional presentation, independent of editable progress.
	// Bundle's vanilla seal atlas has seven known colours. The optional texture
	// override selects the detail-page illustration, not this seal, so remixed
	// and custom illustrations still retain their normal completion frames.
	const savedColor = nonnegative(parts[3]);
	const color =
		savedColor !== undefined && savedColor <= 6 ? savedColor : undefined;
	const needed = parts[4] ? nonnegative(parts[4]) : requirements.length;
	supported &&=
		needed !== undefined && needed > 0 && needed <= requirements.length;
	const rewardTokens = parts[1]?.trim().split(/\s+/) ?? [];
	const rewardQuantity = nonnegative(rewardTokens[2]);
	const reward =
		rewardTokens.length === 3 &&
		rewardQuantity !== undefined &&
		rewardQuantity > 0 &&
		rewardQuantity <= 2147483647 &&
		Object.hasOwn(rewardKinds, rewardTokens[0] ?? "")
			? {
					type: rewardKinds[rewardTokens[0] ?? ""] ?? "",
					itemId: rewardTokens[1] ?? "",
					quantity: rewardQuantity,
				}
			: undefined;
	return {
		id,
		room: room?.id,
		name: parts[6] || parts[0] || "Unknown bundle",
		color,
		requirements,
		needed: needed ?? 0,
		reward,
		rewardMalformed: !!parts[1]?.trim() && !reward,
		supported,
	};
}
/** Engine-only lens: references belong to the provided detached/owned save, never an Atom view. */
export function inspectCommunity(document: SaveDocument) {
	const locations = document.SaveGame.locations ?? [];
	const centers = locations.filter((row) => row?.name === "CommunityCenter");
	// A matching name alone does not authorize writes into an opaque location.
	const center =
		centers.length === 1 &&
		centers[0]?.$type === "StardewValley.Locations.CommunityCenter"
			? centers[0]
			: undefined;
	return {
		center,
		definitions: { entries: document.SaveGame.bundleData ?? [] },
		progress: { entries: center?.bundles ?? [] },
		rewards: { entries: center?.bundleRewards ?? [] },
		supported: !!center,
	};
}
// These helpers accept decoded dictionary entries; only a failed lookup can
// omit an entry. The codec already validates numeric keys and boolean arrays.
export function progressId(entry: { key: number } | undefined) {
	return entry?.key;
}
export function submissionFlags(
	entry: { value: boolean[] } | undefined,
): boolean[] | undefined {
	return entry?.value;
}
/** Loading does not repair rewards, normalize bundle strings or recompute world unlocks. */
export function readCommunity(document: SaveDocument): CommunityView {
	const data = inspectCommunity(document),
		hostMail = mailStrings(document.SaveGame.player.mailReceived);
	const bundles: CommunityBundleView[] = [];
	const definitions = data.definitions.entries;
	for (const entry of definitions) {
		const key = entry.key;
		// One disabled ambiguity row avoids duplicate keyed elements without dropping any saved entries.
		if (bundles.some((row) => row.key === key)) continue;
		const parsed = definition(key, entry.value);
		const peers = data.progress.entries.filter(
			(row) => progressId(row) === parsed?.id,
		);
		const flags = peers.length === 1 ? submissionFlags(peers[0]) : undefined;
		const duplicate =
			definitions.filter((row) => {
				return nonnegative(row.key.split("/")[1]) === parsed?.id;
			}).length !== 1;
		const supported =
			data.supported &&
			!!parsed?.supported &&
			!duplicate &&
			!!flags &&
			flags.length >= parsed.requirements.length;
		const requirements =
			parsed?.requirements.map((row) => ({
				...row,
				submitted: flags?.[row.index] ?? false,
			})) ?? [];
		const submitted = requirements.filter((row) => row.submitted).length;
		const rewards = data.rewards.entries.filter(
			(row) => progressId(row) === parsed?.id,
		);
		const reward = rewards[0],
			pending = reward?.value;
		bundles.push({
			key,
			id: parsed?.id,
			room: parsed?.room,
			name: parsed?.name ?? "Unsupported saved bundle",
			color: parsed?.color,
			supported,
			reason: supported
				? undefined
				: "The saved definition, identity or donation flags are unsupported or ambiguous.",
			requirements,
			needed: parsed?.needed ?? 0,
			submitted,
			completed: supported && submitted >= (parsed?.needed ?? 0),
			reward: parsed?.reward,
			rewardAvailable: pending === true,
			rewardSupported:
				!parsed?.rewardMalformed &&
				rewards.length <= 1 &&
				(rewards.length === 0 || typeof pending === "boolean"),
		});
	}
	// Progress without a known definition remains visible and unavailable; it is never deleted on import.
	for (const [index, entry] of data.progress.entries.entries()) {
		const id = progressId(entry);
		if (bundles.some((row) => row.id === id)) continue;
		bundles.push({
			key: `unknown-progress:${index}`,
			id,
			name: `Unknown bundle ${id ?? "record"}`,
			supported: false,
			reason: "No supported saved definition was found.",
			requirements: [],
			needed: 0,
			submitted: 0,
			completed: false,
			rewardAvailable: false,
			rewardSupported: false,
		});
	}
	const rooms = communityRooms.map((room) => {
		const children = bundles.filter((row) => row.room === room.id);
		return {
			id: room.id,
			name: room.name,
			unlock: room.unlock,
			note: "note" in room ? room.note : undefined,
			completed:
				children.length && children.every((row) => row.supported)
					? children.every((row) => row.completed)
					: undefined,
			restored: hostMail.entries.includes(room.flag),
			project: "project" in room ? room.project : undefined,
			price: "price" in room ? room.price : undefined,
		};
	});
	return {
		supported: data.supported,
		reason: data.supported
			? undefined
			: "A unique supported Community Center location is required.",
		membership: hostMail.supported
			? hostMail.entries.includes("JojaMember")
			: undefined,
		bundles,
		rooms,
		theater: hostMail.entries.includes("ccMovieTheater"),
	};
}
