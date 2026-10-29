import type { EditorModel } from "./editor-model.ts";
import type { ImmediateField } from "./immediate-field.ts";
import { setQiOrder, type QiOrdersView } from "./qi-order-operations.ts";

/** Shared board identities are file-bound rather than tied to the selected farmer. */
export function createQiOrderDomain(view: QiOrdersView, model: EditorModel) {
	return {
		...view,
		rows: view.rows.map((row) => {
			const key = `qi-orders:${JSON.stringify([row.key, "offered"])}`;
			const offered: ImmediateField<boolean> = {
				scope: model.edits.scope,
				key,
				label: `Offer ${row.name}`,
				value: row.offered || row.state !== undefined,
				available: row.offerAvailable,
				reason: row.reason,
				begin: () => model.edits.begin(key),
				commit: (value, gesture) =>
					model.commands.edit(
						setQiOrder({ kind: "offer", key: row.key, value }),
						gesture,
					),
				end: (gesture) => model.edits.end(gesture),
			};
			return {
				...row,
				offeredField: offered,
				accept: () =>
					model.commands.transact(setQiOrder({ kind: "accept", key: row.key })),
				cancel: () =>
					model.commands.transact(setQiOrder({ kind: "cancel", key: row.key })),
			};
		}),
	};
}
