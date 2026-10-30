import { Data, Effect, Result, Schema } from "effect";
import { communityRooms } from "../communityCenterData.ts";
import { progressionFarmers } from "./progression-farmers.ts";
import { record } from "./saved-collections.ts";
import {
	inspectCommunity,
	readCommunity,
	mailStrings,
	submissionFlags,
	progressId,
	type CommunityView,
} from "./community-data.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

export class CommunityInvalid extends Data.TaggedError("CommunityInvalid")<{
	readonly message: string;
}> {}
const invalid = (message: string) =>
	Effect.fail(new CommunityInvalid({ message }));
const integer = Schema.Number.check(
	Schema.isInt(),
	Schema.isGreaterThanOrEqualTo(0),
);
const requestSchema = Schema.Union([
	Schema.Struct({
		type: Schema.Literal("donation"),
		bundleKey: Schema.String,
		index: integer,
		itemId: Schema.String,
		quantity: integer,
		quality: integer,
		value: Schema.Boolean,
	}),
	Schema.Struct({
		type: Schema.Literals(["bundle", "reward"]),
		bundleKey: Schema.String,
		value: Schema.Boolean,
	}),
	Schema.Struct({
		type: Schema.Literal("project"),
		room: integer,
		value: Schema.Boolean,
	}),
	Schema.Struct({ type: Schema.Literal("membership"), value: Schema.Boolean }),
	Schema.Struct({ type: Schema.Literal("theater"), value: Schema.Boolean }),
]);
export type CommunityChange = typeof requestSchema.Type;
const decode = Schema.decodeUnknownResult(requestSchema, {
	onExcessProperty: "error",
});

/** Mail variants follow each farmer's membership. Preserve duplicates and unrelated flags as loaded. */
const editMail = Effect.fn("Community.mail")(function* (
	farmer: unknown,
	transform: (mail: string[]) => string[],
) {
	if (!record(farmer))
		return yield* invalid("A saved farmer record is unsupported.");
	const data = mailStrings(farmer.mailReceived);
	if (!data.supported)
		return yield* invalid("A farmer's received mail list is unsupported.");
	const next = transform([...data.entries]);
	if (
		next.length === data.entries.length &&
		next.every((value, index) => value === data.entries[index])
	)
		return;
	farmer.mailReceived = { ...(record(data.raw) ? data.raw : {}), string: next };
});
function flags(
	mail: string[],
	additions: readonly string[],
	removals: readonly string[],
) {
	const next = mail.filter((flag) => !removals.includes(flag));
	for (const flag of additions) if (!next.includes(flag)) next.push(flag);
	return next;
}
/** Unknown original rooms cannot be silently treated as complete by an empty every(). */
function overall(view: CommunityView): boolean | undefined {
	const required = view.rooms.filter(
		(room) => room.id < 6 && (!view.membership || room.id !== 5),
	);
	if (required.length !== (view.membership ? 5 : 6)) return;
	if (view.membership)
		return required.every((room) => room.restored || room.completed === true);
	return required.some((room) => room.completed === undefined)
		? undefined
		: required.every((room) => room.completed);
}
export const setCommunityProgress = Effect.fn("Community.setProgress")(
	function* (input: CommunityChange) {
		const decoded = decode(
			input && typeof input === "object" ? { ...input } : input,
		);
		if (Result.isFailure(decoded))
			return yield* invalid("Choose a valid Community Center change.");
		const change = decoded.success,
			draft = yield* TransactionDraft,
			snapshot = yield* draft.read,
			document = snapshot.state.document;
		const before = readCommunity(document),
			data = inspectCommunity(document),
			center = data.center;
		if (!before.supported || !center)
			return yield* invalid(
				before.reason ?? "The saved bundle data is unsupported.",
			);
		const recipients = yield* progressionFarmers(document);
		const roomBefore = new Map(
			before.rooms.map((room) => [room.id, room.completed]),
		);
		let label: string;
		// A room transition owns its flags and affected mail together. No unrelated
		// room is recomputed merely because another donation changed.
		const applyRoom = Effect.fn("Community.room")(function* (
			roomId: number,
			completed: boolean,
		) {
			const room = communityRooms.find((row) => row.id === roomId);
			if (!room)
				return yield* invalid("This room's progression is unsupported.");
			const raw = center.areasComplete;
			const existing = record(raw) ? raw.boolean : undefined;
			if (
				raw !== undefined &&
				raw !== null &&
				raw !== "" &&
				(!Array.isArray(existing) ||
					existing.some((value) => typeof value !== "boolean"))
			)
				return yield* invalid("Community Center room flags are unsupported.");
			const areas = Array.isArray(existing)
				? [...existing]
				: Array<boolean>(6).fill(false);
			while (areas.length <= roomId || areas.length < 6) areas.push(false);
			areas[roomId] = completed;
			// The game uses the optional seventh note only when the Missing Bundle is
			// complete. Preserve modded trailing entries rather than truncating them.
			if (areas.length === 7 && areas[6] === false) areas.pop();
			center.areasComplete = { ...(record(raw) ? raw : {}), boolean: areas };
			for (const farmer of recipients)
				yield* editMail(farmer, (mail) => {
					const variant = "jojaFlag" in room ? room.jojaFlag : undefined;
					return flags(
						mail,
						completed
							? [
									room.flag,
									...(variant && mail.includes("JojaMember") ? [variant] : []),
								]
							: [],
						!completed
							? [room.flag, ...(variant ? [variant] : [])]
							: variant && !mail.includes("JojaMember")
								? [variant]
								: [],
					);
				});
		});
		const setReward = Effect.fn("Community.reward")(function* (
			bundleKey: string,
			value: boolean,
		) {
			const bundle = readCommunity(document).bundles.find(
				(row) => row.key === bundleKey,
			);
			if (
				!bundle?.supported ||
				bundle.id === undefined ||
				!bundle.rewardSupported
			)
				return yield* invalid("This bundle's reward flags are unsupported.");
			if (value && (bundle.id === 36 || !bundle.completed || !bundle.reward))
				return yield* invalid(
					"This bundle has no safe reward to make available.",
				);
			const entries = data.rewards.entries.filter(
				(row) => progressId(row) === bundle.id,
			);
			const entry = entries[0];
			if (record(entry) && record(entry.value)) entry.value.boolean = value;
			else if (value)
				center.bundleRewards = {
					...(record(center.bundleRewards) ? center.bundleRewards : {}),
					item: [
						...data.rewards.entries,
						{ key: { int: bundle.id }, value: { boolean: value } },
					],
				};
		});
		// Use fresh reward collections for repeated children: insertion must not replace
		// an earlier child's newly staged pending reward in the same room transaction.
		const rewardTransition = Effect.fn("Community.rewardTransition")(function* (
			key: string,
			wasComplete: boolean,
		) {
			const after = readCommunity(document).bundles.find(
				(row) => row.key === key,
			);
			if (!after?.supported)
				return yield* invalid("This bundle no longer has supported progress.");
			if (wasComplete === after.completed) return;
			// Rewards are availability flags, never items inserted into a farmer's bag.
			// The Missing Bundle must never acquire a claimable reward (it crashes the game).
			const current = inspectCommunity(document).rewards;
			const entry = current.entries.find((row) => progressId(row) === after.id);
			if (!after.rewardSupported)
				return yield* invalid("This bundle's reward flags are unsupported.");
			const pending = after.completed && after.id !== 36 && !!after.reward;
			if (record(entry) && record(entry.value)) entry.value.boolean = pending;
			else if (pending)
				center.bundleRewards = {
					...(record(center.bundleRewards) ? center.bundleRewards : {}),
					item: [
						...current.entries,
						{ key: { int: after.id }, value: { boolean: pending } },
					],
				};
		});
		const editBundle = Effect.fn("Community.bundle")(function* (
			key: string,
			value: boolean,
			index?: number,
		) {
			const bundle = readCommunity(document).bundles.find(
				(row) => row.key === key,
			);
			if (!bundle?.supported || bundle.id === undefined)
				return yield* invalid(
					bundle?.reason ?? "This bundle is no longer available.",
				);
			const entries = data.progress.entries.filter(
					(row) => progressId(row) === bundle.id,
				),
				submitted = submissionFlags(entries[0]);
			if (!submitted)
				return yield* invalid("This bundle's donation flags are unsupported.");
			const indices =
				index === undefined
					? bundle.requirements.map((row) => row.index)
					: [index];
			for (const slot of indices) {
				if (!bundle.requirements.some((row) => row.index === slot))
					return yield* invalid("This requirement is no longer available.");
				submitted[slot] = value;
			}
			yield* rewardTransition(key, bundle.completed);
		});
		if (change.type === "membership") {
			if (before.membership === undefined)
				return yield* invalid("The host's Joja membership is unsupported.");
			for (const farmer of recipients)
				yield* editMail(farmer, (mail) =>
					flags(
						mail,
						change.value ? ["JojaMember"] : [],
						change.value ? [] : ["JojaMember"],
					),
				);
			label = change.value
				? "Enable Joja membership"
				: "Disable Joja membership";
		} else if (change.type === "project") {
			const room = before.rooms.find(
				(row) => row.id === change.room && row.project,
			);
			if (!before.membership || !room || room.completed === undefined)
				return yield* invalid("Choose a supported Joja project.");
			for (const bundle of before.bundles.filter(
				(row) => row.room === change.room,
			))
				yield* editBundle(bundle.key, change.value);
			// A bought project can have world flags even with no corresponding donations.
			// Explicitly changing that project owns its flags, regardless of the prior mismatch.
			yield* applyRoom(change.room, change.value);
			label = `${change.value ? "Complete" : "Reopen"} Joja ${room.project} project`;
		} else if (change.type === "theater") {
			if (
				!before.membership ||
				(change.value &&
					!before.rooms
						.filter((room) => room.project)
						.every((room) => room.restored || room.completed === true))
			)
				return yield* invalid(
					"Complete the five Joja projects before building the Movie Theater.",
				);
			for (const bundle of before.bundles.filter((row) => row.room === 6))
				yield* editBundle(bundle.key, change.value);
			yield* applyRoom(6, change.value);
			label = change.value
				? "Build Joja Movie Theater"
				: "Reopen Joja Movie Theater project";
		} else {
			const bundle = before.bundles.find((row) => row.key === change.bundleKey);
			if (!bundle?.supported)
				return yield* invalid(bundle?.reason ?? "Choose a supported bundle.");
			if (change.type === "donation") {
				const requirement = bundle.requirements.find(
					(row) => row.index === change.index,
				);
				if (
					!requirement ||
					requirement.itemId !== change.itemId ||
					requirement.quantity !== change.quantity ||
					requirement.quality !== change.quality
				)
					return yield* invalid(
						"The saved requirement changed. Choose it again.",
					);
				yield* editBundle(bundle.key, change.value, change.index);
				label = `${change.value ? "Donate to" : "Reopen donation in"} ${bundle.name}`;
			} else if (change.type === "reward") {
				yield* setReward(bundle.key, change.value);
				label = `${change.value ? "Make reward available" : "Mark reward collected"}: ${bundle.name}`;
			} else {
				yield* editBundle(bundle.key, change.value);
				label = `${change.value ? "Complete" : "Reopen"} ${bundle.name} bundle`;
			}
		}
		const afterProgress = readCommunity(document),
			membershipChanged = before.membership !== afterProgress.membership;
		for (const room of afterProgress.rooms) {
			if (room.completed === undefined) continue;
			if (
				(roomBefore.get(room.id) !== undefined &&
					roomBefore.get(room.id) !== room.completed) ||
				(membershipChanged && room.completed)
			)
				yield* applyRoom(room.id, room.completed);
		}
		// Completion of the five original Joja projects does not buy the theater.
		// Original CC completion likewise excludes the Missing Bundle and preserves door access.
		const after = readCommunity(document),
			wasOverall = overall(before),
			nowOverall = overall(after);
		if (
			nowOverall !== undefined &&
			((wasOverall !== undefined && wasOverall !== nowOverall) ||
				(membershipChanged && nowOverall))
		) {
			for (const farmer of recipients)
				yield* editMail(farmer, (mail) => {
					if (!nowOverall)
						return flags(
							mail,
							[],
							[
								"ccIsComplete",
								"ccBulletinThankYou",
								"abandonedJojaMartAccessible",
							],
						);
					return flags(
						mail,
						[
							"ccIsComplete",
							"ccBulletinThankYou",
							"seenJunimoNote",
							...(!mail.includes("JojaMember")
								? ["abandonedJojaMartAccessible"]
								: []),
						],
						mail.includes("JojaMember") ? ["abandonedJojaMartAccessible"] : [],
					);
				});
		}
		// Clear only the known unsafe reward. Unknown reward keys and unrelated imported
		// members survive; importing/viewing never performs the legacy global sanitizer.
		const missing = inspectCommunity(document).rewards.entries.filter(
			(row) => progressId(row) === 36,
		);
		if (missing.length > 1)
			return yield* invalid(
				"The Missing Bundle reward has duplicate saved keys.",
			);
		const unsafe = missing[0];
		if (record(unsafe) && record(unsafe.value) && unsafe.value.boolean === true)
			unsafe.value.boolean = false;
		yield* recordAnnotatedOperation(draft.replace(snapshot)).pipe(
			withReviewMetadata({
				label,
				tags: ["community-center", `community:${change.type}`],
			}),
		);
	},
);
