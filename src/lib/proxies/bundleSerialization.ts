import { CCRoom } from "$lib/bundleSideEffects";

/** Triplet describing a single bundle requirement: [itemID, quantity, quality] */
export type BundleRequirement = [string, number, number];

export interface ParsedBundleKey {
	room: CCRoom;
	roomName: string; // canonical room name text as it appears in the save
	spriteIndex: number; // bundle icon index
}

export interface ParsedBundleValue {
	name: string; // internal name (not translated)
	reward?: string; // raw reward segment (e.g. "BO 194 1")
	requirements: BundleRequirement[]; // list of requirement triplets
	color?: number; // bundle color index
	count?: number; // required number of submissions (optional, may be omitted)
	// Any additional trailing segments after the standard five (e.g., localized display name),
	// preserved verbatim to ensure exact XML roundtrip.
	tailSegments?: string[];
}

// Mapping between room string identifiers and CCRoom enum
const ROOM_NAME_TO_ENUM: Record<string, CCRoom> = {
	Pantry: CCRoom.Pantry,
	"Crafts Room": CCRoom.CraftsRoom,
	"Fish Tank": CCRoom.FishTank,
	"Boiler Room": CCRoom.BoilerRoom,
	Vault: CCRoom.Vault,
	"Bulletin Board": CCRoom.BulletinBoard,
	"Abandoned Joja Mart": CCRoom.AbandonedJojaMart,
};

/** Parse the bundle key string ("<roomName>/<spriteIndex>"). */
export function parseBundleKey(raw: string): ParsedBundleKey {
	const [roomName, spriteIndexStr] = raw.split("/");
	if (!roomName || !spriteIndexStr)
		throw new Error(`Invalid bundle key: ${raw}`);
	const room = ROOM_NAME_TO_ENUM[roomName];
	if (room === undefined) throw new Error(`Invalid room name: ${roomName}`);
	const spriteIndex = Number.parseInt(spriteIndexStr, 10);
	if (Number.isNaN(spriteIndex))
		throw new Error(`Invalid sprite index: ${spriteIndexStr}`);
	return { room, roomName, spriteIndex };
}

/** Serialize a parsed bundle key back to its canonical string form. */
export function serializeBundleKey(key: ParsedBundleKey): string {
	return `${key.roomName}/${key.spriteIndex}`;
}

/** Parse a bundle value string with defensive validation. */
export function parseBundleValue(raw: string): ParsedBundleValue {
	const segments = raw.split("/");
	const name = segments[0];
	const rewardSeg = segments[1] ?? "";
	const requirementsSeg = segments[2];
	const colorSeg = segments[3];
	const countSeg = segments[4];
	const tailSegments = segments.length > 5 ? segments.slice(5) : undefined;
	if (!name) throw new Error("Bundle value missing name segment");
	if (!requirementsSeg)
		throw new Error("Bundle value missing requirements segment");
	const tokens = requirementsSeg
		.trim()
		.replace(/\s+/g, " ")
		.split(" ")
		.filter(Boolean);
	if (tokens.length % 3 !== 0)
		throw new Error(
			`Requirements segment length not multiple of 3: ${requirementsSeg}`,
		);
	const requirements: BundleRequirement[] = [];
	for (let i = 0; i < tokens.length; i += 3) {
		const itemID = tokens[i];
		const qtyToken = tokens[i + 1];
		const qualityToken = tokens[i + 2];
		if (!itemID || !qtyToken || !qualityToken)
			throw new Error(
				`Invalid requirement triplet at index ${i / 3}: ${tokens.slice(i, i + 3).join(" ")}`,
			);
		const qty = Number.parseInt(qtyToken, 10);
		const quality = Number.parseInt(qualityToken, 10);
		if (Number.isNaN(qty) || Number.isNaN(quality))
			throw new Error(
				`Invalid numeric values in requirement triplet at index ${i / 3}: ${tokens.slice(i, i + 3).join(" ")}`,
			);
		requirements.push([itemID, qty, quality]);
	}
	const color = colorSeg ? Number.parseInt(colorSeg, 10) : undefined;
	const count = countSeg ? Number.parseInt(countSeg, 10) : undefined;
	const safeColor =
		color !== undefined && !Number.isNaN(color) ? color : undefined;
	const safeCount =
		count !== undefined && !Number.isNaN(count) ? count : undefined;
	return {
		name,
		reward: rewardSeg || undefined,
		requirements,
		color: safeColor,
		count: safeCount,
		tailSegments,
	};
}

/** Serialize a parsed bundle value back to its canonical string form. */
export function serializeBundleValue(v: ParsedBundleValue): string {
	const req = v.requirements
		.map(([id, qty, qual]) => `${id} ${qty} ${qual}`)
		.join(" ");
	const rewardSeg = v.reward ?? "";
	const colorSeg = v.color !== undefined ? v.color : "";
	const countSeg = v.count !== undefined ? v.count : "";
	let result = `${v.name}/${rewardSeg}/${req}/${colorSeg}/${countSeg}`;
	if (v.tailSegments?.length) {
		// Append any trailing segments exactly as they were parsed (including empties)
		result += `/${v.tailSegments.join("/")}`;
	}
	const segs = result.split("/");
	if (segs.length < 5)
		console.error(
			"[BundleDiag] serializeBundleValue produced too few segments",
			{ input: v, result, segs, stack: new Error().stack },
		);
	try {
		parseBundleValue(result);
	} catch (e) {
		console.error("[BundleDiag] Round-trip parse failed after serialization", {
			input: v,
			result,
			error: e,
		});
	}
	return result;
}

/** Update helper for immutably replacing a single requirement triplet. */
export function replaceRequirement(
	valueString: string,
	index: number,
	triplet: BundleRequirement,
): string {
	const parsed = parseBundleValue(valueString);
	if (!parsed.requirements[index])
		throw new Error(`Requirement index ${index} out of range`);
	parsed.requirements[index] = triplet;
	return serializeBundleValue(parsed);
}

/** Update helper for re-writing only the name field. */
export function withBundleName(valueString: string, name: string): string {
	const parsed = parseBundleValue(valueString);
	parsed.name = name;
	return serializeBundleValue(parsed);
}

/** Convenience wrapper to update reward (raw form). */
export function withBundleReward(
	valueString: string,
	reward: string | undefined,
): string {
	const parsed = parseBundleValue(valueString);
	parsed.reward = reward;
	return serializeBundleValue(parsed);
}

// Diagnostic helper to inspect a raw bundle value without mutating state.
export function debugInspectBundleValue(raw: string) {
	const segments = raw.split("/");
	const info: Record<string, unknown> = {
		raw,
		segmentCount: segments.length,
		segments,
	};
	try {
		info.parsed = parseBundleValue(raw);
	} catch (e) {
		info.error = (e as Error).message;
	}
	console.info("[BundleDiag] Inspect", info);
}
