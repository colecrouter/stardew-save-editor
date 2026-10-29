import type { ImmutableView } from "./immutable-view.ts";
import { bindImmediateField, type DomainEditPort } from "./field-binding.ts";
import { setQiOrder, type QiOrdersView } from "./qi-order-operations.ts";

/** Shared board identities are file-bound rather than tied to the selected farmer. */
export function createQiOrderDomain(
	view: ImmutableView<QiOrdersView>,
	model: DomainEditPort,
) {
	return {
		...view,
		rows: view.rows.map((row) => {
			const key = `qi-orders:${JSON.stringify([row.key, "offered"])}`;
			const offered = bindImmediateField(
				model,
				{
					key,
					label: `Offer ${row.name}`,
					value: row.offered || row.state !== undefined,
					available: row.offerAvailable,
					reason: row.reason,
				},
				(value: boolean) => setQiOrder({ kind: "offer", key: row.key, value }),
			);
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
