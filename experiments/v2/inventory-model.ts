import { Effect, Exit, Scope, type Context } from "effect";
import { derived, type Readable } from "svelte/store";
import { parseStack, type NumericField } from "./field.ts";
import { farmers, type Mutation, type SaveDocument } from "./domain.ts";
import { makeHistorySession } from "./history.ts";

export type HistorySession = Effect.Success<
	ReturnType<typeof makeHistorySession>
>;
export type HistoryState = Effect.Success<HistorySession["snapshot"]>;
export interface ItemView {
	entityId: string;
	id: string;
	name: string;
	stack: number;
	editable: boolean;
	slot: number;
}
export interface InventoryModel {
	historyUsage: Readable<{ bytes: number; dropped: number }>;
	stackField: NumericField;
	kind: "atom" | "store";
	items: Readable<ItemView[]>;
	selected: Readable<ItemView | undefined>;
	money: Readable<number>;
	canUndo: Readable<boolean>;
	canRedo: Readable<boolean>;
	count: Readable<number>;
	error: Readable<string>;
	stack: Readable<number> & { set: (value: number) => void };
	chooseSlot: (slot: number) => void;
	chooseFarmer: (id: string) => void;
	undo: () => void;
	redo: () => void;
	reverse: () => void;
	debug: () => { nodes: number; liveStreams: number };
}

// Both presentation adapters expose the same domain-backed field contract.
// Capturing the target here prevents a later selection change from retargeting it.
export function makeStackField(
	session: HistorySession,
	state: Readable<HistoryState>,
	farmer: Readable<string>,
	slot: Readable<number>,
	services: Context.Context<never>,
): NumericField {
	return {
		constraints: { min: 1, max: 999, step: 1 },
		actionLabel: "Apply stack",
		label: "Stack size",
		description: "Apply a whole number from 1 to 999 as one undoable action.",
		parse: parseStack,
		format: String,
		value: derived([state, farmer, slot], ([state, farmerId, slot]) => {
			const item = inventory(state, farmerId)[slot];
			return {
				key: JSON.stringify([farmerId, item?.entityId]),
				value: item?.stack ?? 0,
				revision: state.revision,
				available: item?.editable ?? false,
				commit: async (value: number) => {
					await Effect.runPromiseWith(services)(
						session.execute(
							[stackAction(farmerId, item, value)],
							undefined,
							state.revision,
						),
					);
				},
			};
		}),
	};
}

export function inventory(state: HistoryState, farmerId: string): ItemView[] {
	const farmer = farmers(state.document).find(
		(farmer) => String(farmer.UniqueMultiplayerID) === farmerId,
	);
	return (farmer?.items.Item ?? []).map((raw, slot) => {
		const item =
			raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
		return {
			entityId: state.identities[farmerId]?.[slot] ?? "",
			slot,
			id: String(item.itemId ?? ""),
			name: String(item.name ?? "Empty"),
			stack: typeof item.stack === "number" ? item.stack : 0,
			editable:
				item["@_xsi:type"] === "Object" &&
				item.bigCraftable !== true &&
				typeof item.stack === "number",
		};
	});
}
export const sameView = <A>(left: A, right: A) =>
	JSON.stringify(left) === JSON.stringify(right);
export const stackAction = (
	farmerId: string,
	item: ItemView | undefined,
	value: number,
): Mutation => ({
	type: "item-stack",
	farmerId,
	slot: item?.slot ?? -1,
	itemId: item?.id ?? "",
	entityId: item?.entityId,
	value,
});

export function inventoryFixture(): SaveDocument {
	const item = (itemId: string, name: string, stack: number) => ({
		"@_xsi:type": "Object",
		itemId,
		name,
		stack,
		quality: 0,
		modData: { keep: "007" },
	});
	return {
		SaveGame: {
			player: {
				UniqueMultiplayerID: "host",
				name: "Host",
				farmName: "Farm",
				money: 10,
				items: {
					Item: [
						item("72", "Diamond", 2),
						item("388", "Wood", 50),
						{ "@_xsi:nil": "true" },
					],
				},
			},
			farmhands: {
				Farmer: [
					{
						UniqueMultiplayerID: "guest",
						name: "Guest",
						farmName: "Farm",
						money: 20,
						items: { Item: [item("390", "Stone", 12)] },
					},
				],
			},
		},
	};
}

// Opening is an explicit application boundary. An aborted constructor closes its
// partially acquired scope; closing a panel/session disposes its registry/streams.
export async function openInventory(
	create: (
		session: HistorySession,
	) => Effect.Effect<InventoryModel, never, Scope.Scope>,
	document = inventoryFixture(),
) {
	const scope = Scope.makeUnsafe();
	try {
		const session = await Effect.runPromise(
			makeHistorySession(document).pipe(
				Effect.provideService(Scope.Scope, scope),
			),
		);
		const model = await Effect.runPromise(
			create(session).pipe(Effect.provideService(Scope.Scope, scope)),
		);
		return {
			model,
			session,
			close: () =>
				Effect.runPromise(Scope.close(scope, Exit.succeed(undefined))),
		};
	} catch (error) {
		await Effect.runPromise(Scope.close(scope, Exit.succeed(undefined)));
		throw error;
	}
}
