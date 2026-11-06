import { Data, Effect, Result } from "effect";
import {
	diff,
	farmers,
	MutationError,
	type SaveDocument,
	type SessionState,
} from "./domain.ts";

import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

// These failures belong to this domain. Callers can catch one by tag without a
// framework-maintained union of every feature's errors or parsing message text.
export class BundleUnavailable extends Data.TaggedError("BundleUnavailable")<{
	readonly message: string;
}> {}
export class BundleProgressInvalid extends Data.TaggedError(
	"BundleProgressInvalid",
)<{ readonly message: string }> {}
export class BundleMailInvalid extends Data.TaggedError("BundleMailInvalid")<{
	readonly message: string;
	readonly farmerId: string;
}> {}

// Bounded second-domain proof: vanilla Spring Foraging only. Unsupported saves
// remain editable elsewhere; this adapter never normalizes their bundle data.
interface BundleRecord {
	key: { int: number };
	value: { ArrayOfBoolean: { boolean: boolean[] } };
}
interface BundleGame {
	bundleData: {
		item: { key: { string: string }; value: { string: string } }[];
	};
	locations: {
		GameLocation: {
			name: string;
			bundles: { item: BundleRecord[] };
			bundleRewards: {
				item: { key: { int: number }; value: { boolean: boolean } }[];
			};
			areasComplete: { boolean: boolean[] };
		}[];
	};
}
// The encoded definition is deliberately an exact compatibility gate. A modded
// reward/requirement/localization layout must not receive guessed vanilla writes.
const vanilla =
	"Spring Foraging/O 495 30/16 1 0 18 1 0 20 1 0 22 1 0/0///Spring Foraging";
// Resolve a unique save target without repairing or normalizing anything. The
// view uses this same inspection so merely opening the panel cannot change XML.
const inspect = Effect.fn("Bundles.inspect")(function* (
	document: SaveDocument,
) {
	const game = document.SaveGame as unknown as BundleGame;
	const centers = game.locations.GameLocation.filter(
		(location) => location.name === "CommunityCenter",
	);
	const cc = centers[0];
	if (!cc || centers.length !== 1)
		return yield* new BundleProgressInvalid({
			message: "A single Community Center is required.",
		});
	const definitions = game.bundleData.item;
	const targets = definitions.filter(
		(entry) => entry.key.string === "Crafts Room/13",
	);
	if (targets.length !== 1 || targets[0]?.value.string !== vanilla)
		return yield* new BundleUnavailable({
			message: "This sample supports the vanilla Spring Foraging bundle only.",
		});
	const records = cc.bundles.item.filter((entry) => entry.key.int === 13);
	const record = records[0];
	if (!record || records.length !== 1)
		return yield* new BundleProgressInvalid({
			message: "Spring Foraging progress is missing or duplicated.",
		});
	// Vanilla reserves more donation flags than this bundle consumes. Validate the
	// representation, but preserve those unused flags when completing four slots.
	const submitted = record.value.ArrayOfBoolean.boolean;
	if (
		!Array.isArray(submitted) ||
		submitted.length < 4 ||
		submitted.some((value) => typeof value !== "boolean")
	)
		return yield* new BundleProgressInvalid({
			message: "Spring Foraging progress is malformed.",
		});
	const rewards = cc.bundleRewards.item.filter((entry) => entry.key.int === 13);
	if (
		rewards.length > 1 ||
		(rewards.length === 1 && typeof rewards[0]?.value.boolean !== "boolean")
	)
		return yield* new BundleProgressInvalid({
			message: "Spring Foraging reward is malformed or duplicated.",
		});
	return { cc, definitions, submitted, reward: rewards[0] };
});
// Unsupported bundle data disables only this sample. Other features can still
// edit the full preservation document, including opaque mod data.
export function springBundleView(document: SaveDocument) {
	// This synchronous projection consumes typed inspection failures only. Defects
	// escape to the application boundary instead of masquerading as unsupported data.
	const inspected = Effect.runSync(Effect.result(inspect(document)));
	if (Result.isFailure(inspected))
		return {
			supported: false,
			completed: false,
			rewardAvailable: false,
			reason: inspected.failure.message,
		};
	const { submitted, reward } = inspected.success;
	return {
		supported: true,
		completed: submitted.slice(0, 4).every(Boolean),
		rewardAvailable: reward?.value.boolean === true,
		reason: "",
	};
}
// Preparation is lazy and named for tracing. Expected rule failures stay in the
// Effect error channel, while all writes target the transaction-owned snapshot.
const complete = Effect.fn("Bundles.prepareSpringForaging")(function* (
	document: SaveDocument,
) {
	const { cc, definitions, submitted, reward } = yield* inspect(document);
	// Completion is idempotent: an already-completed bundle may have had its reward
	// claimed. Repeating this command must never issue that reward again.
	if (submitted.slice(0, 4).every(Boolean)) return false; // Never reissue a claimed reward.
	// A room repair depends on every bundle in that room, not just this donation.
	// Bound the proof to the vanilla room membership before deriving that result.
	const roomDefinitions = definitions.filter((entry) =>
		entry.key.string.startsWith("Crafts Room/"),
	);
	const ids = roomDefinitions.map((entry) =>
		Number(entry.key.string.split("/")[1]),
	);
	if (
		ids.length !== 6 ||
		new Set(ids).size !== 6 ||
		![13, 14, 15, 16, 17, 19].every((id) => ids.includes(id))
	)
		return yield* new BundleProgressInvalid({
			message: "The sample requires the six vanilla Crafts Room bundle IDs.",
		});
	const areas = cc.areasComplete.boolean;
	if (
		!Array.isArray(areas) ||
		areas.length < 6 ||
		areas.length > 7 ||
		areas.some((value) => typeof value !== "boolean")
	)
		return yield* new BundleProgressInvalid({
			message: "Community Center room progress is unsupported.",
		});
	// Optional requirement counts allow bundles such as choose-N donations. Count
	// only actual requirement slots; trailing reserved flags do not complete them.
	// Validate each member explicitly so expected failures use the error channel.
	let roomComplete = true;
	for (const definition of roomDefinitions) {
		const id = Number(definition.key.string.split("/")[1]);
		const parts = definition.value.string.split("/");
		const tokens = parts[2]?.trim().split(/\s+/) ?? [];
		const required = parts[4] ? Number(parts[4]) : tokens.length / 3;
		const records = cc.bundles.item.filter((entry) => entry.key.int === id);
		if (
			tokens.length === 0 ||
			tokens.length % 3 ||
			!Number.isInteger(required) ||
			required < 1 ||
			required > tokens.length / 3 ||
			records.length !== 1
		)
			return yield* new BundleProgressInvalid({
				message: "A Crafts Room bundle definition is unsupported.",
			});
		const flags = records[0]?.value.ArrayOfBoolean.boolean;
		if (
			!Array.isArray(flags) ||
			flags.length < tokens.length / 3 ||
			flags.some((value) => typeof value !== "boolean")
		)
			return yield* new BundleProgressInvalid({
				message: "A Crafts Room bundle has malformed progress.",
			});
		if (
			id !== 13 &&
			flags.slice(0, tokens.length / 3).filter(Boolean).length < required
		)
			roomComplete = false;
	}

	// Everything below mutates a detached preparation draft. Even a late mail
	// validation failure must discard all donations, reward and room changes.
	const previouslyComplete = areas.slice(0, 6).every(Boolean);
	for (let index = 0; index < 4; index++) submitted[index] = true;
	if (reward) reward.value.boolean = true;
	else
		cc.bundleRewards.item.push({ key: { int: 13 }, value: { boolean: true } });
	if (!roomComplete) return true;
	// Apply repair/mail side effects only on a completion transition. Existing
	// completed rooms may contain game-established flags we must not recompute.
	const newlyComplete = !areas[1];
	areas[1] = true;
	const overall = !previouslyComplete && areas.slice(0, 6).every(Boolean);
	if (!newlyComplete && !overall) return true;
	// Room unlocks affect all farmers. Preserve unrelated mail and duplicates; only
	// the editor-owned flags below have set-like insertion/removal semantics.
	for (const farmer of farmers(document)) {
		const player = farmer as unknown as {
			mailReceived: "" | { string: string[] };
		};
		if (
			player.mailReceived !== "" &&
			(!player.mailReceived ||
				!Array.isArray(player.mailReceived.string) ||
				player.mailReceived.string.some((flag) => typeof flag !== "string"))
		)
			return yield* new BundleMailInvalid({
				message: "Farmer mail flags are unsupported.",
				farmerId: String(farmer.UniqueMultiplayerID),
			});
		let mail =
			player.mailReceived === "" ? [] : [...player.mailReceived.string];
		const add = (flag: string) => {
			if (!mail.includes(flag)) mail.push(flag);
		};
		const remove = (flag: string) => {
			mail = mail.filter((value) => value !== flag);
		};
		if (newlyComplete) {
			add("ccCraftsRoom");
			if (mail.includes("JojaMember")) add("jojaCraftsRoom");
			else remove("jojaCraftsRoom");
		}
		// Match the legacy editor's immediate completion policy. Joja membership is
		// per farmer for these mail variants; this does not simulate overnight play.
		if (overall) {
			for (const flag of [
				"ccIsComplete",
				"ccBulletinThankYou",
				"seenJunimoNote",
			])
				add(flag);
			if (mail.includes("JojaMember")) remove("abandonedJojaMartAccessible");
			else add("abandonedJojaMartAccessible");
		}
		if (player.mailReceived === "") player.mailReceived = { string: mail };
		else player.mailReceived.string = mail;
	}
	return true;
});

export const completeSpringForaging = Effect.fn(
	"Bundles.completeSpringForaging",
)(function* () {
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const changed = yield* complete(snapshot.state.document);
	// Repeating a completed bundle does not add a review row to a group whose
	// only real change came from a different operation.
	if (!changed) return;
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label: "Complete Spring Foraging bundle",
			emphasis: "standalone",
			tags: ["community-center", "bundle:13"],
		}),
	);
});

// Legacy command callers retain MutationError until their migration. Only this
// compatibility boundary maps tagged domain failures into the older error type.
export const prepareBundleOperation = (
	state: SessionState,
	action: { type: "bundle-complete"; bundleId: 13 },
): Effect.Effect<SessionState, MutationError> =>
	Effect.gen(function* () {
		if (action.bundleId !== 13)
			return yield* new BundleUnavailable({
				message: "Only Spring Foraging is supported by this sample.",
			});
		const document = structuredClone(state.document);
		yield* complete(document);
		// Actual differences define undo/export; a repeated completion stays a no-op.
		const changes = diff(state.document, document);
		if (changes.length === 0) return state;
		return {
			...state,
			document,
			history: [
				...state.history,
				{
					intent: structuredClone(action),
					label: "Complete Spring Foraging bundle",
					review: "standalone" as const,
					changes,
				},
			],
		};
	}).pipe(Effect.mapError((error) => new MutationError(error.message)));
