import type { EditorModel } from "./editor-model.ts";
import type { ImmediateField } from "./immediate-field.ts";
import { setEventSeen, type EventFarmerView } from "./event-operations.ts";
import { toEventId } from "../eventId.ts";

/** Capture the selected farmer once; queued event changes never follow selection. */
export function createEventDomain(view: EventFarmerView, model: EditorModel) {
	return {
		...view,
		field(id: string, label: string): ImmediateField<boolean> {
			const saved = view.seen.find((row) => row.id === id);
			const key = `events:${JSON.stringify([view.farmerId, id])}`;
			return {
				scope: model.edits.scope,
				key,
				label,
				value: saved !== undefined,
				available: view.supported && (!saved || saved.supported),
				reason: view.reason ?? saved?.reason,
				begin: () => model.edits.begin(key),
				commit: (seen, gesture) =>
					model.commands.edit(
						setEventSeen({ farmerId: view.farmerId, id, seen }),
						gesture,
					),
				end: (gesture) => model.edits.end(gesture),
			};
		},
		add: (id: string) =>
			model.commands.transact(
				setEventSeen({ farmerId: view.farmerId, id, seen: true }),
			),
		remove: (id: string) =>
			model.commands.transact(
				setEventSeen({ farmerId: view.farmerId, id, seen: false }),
			),
	};
}
export { toEventId };
