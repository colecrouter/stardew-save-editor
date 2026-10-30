import type { EquipmentSlot } from "../equipment.ts";
import type { InventoryView } from "../inventory-views.ts";
import {
	allInventorySlots as allSlots,
	isEquipmentSlot as isEquipment,
	type InventorySlot,
} from "./inventory-slot.ts";

/** Captured instance handles, never saved item data or mutable slot positions. */
export interface InventoryDragSource {
	readonly ownerId: string;
	readonly entityId: string;
	readonly location: "backpack" | EquipmentSlot;
}
interface DragInput {
	readonly token: string;
	readonly owners: () => readonly InventoryView[];
	readonly visibleOwners: () => readonly (InventoryView | undefined)[];
	readonly root: () => HTMLElement | undefined;
	readonly movePending: () => boolean;
	readonly selectedEntity: () => string | undefined;
	readonly ownerOf: (item: InventorySlot) => InventoryView | undefined;
	readonly choose: (entityId: string) => void;
	readonly move: (item: InventorySlot, source: InventoryDragSource) => void;
}

/** Component-owned native/touch drag session. Domain commands still authorize
 * both endpoints; local eligibility controls hover hints only. Dispose on unmount
 * so an abandoned held gesture cannot retain its animation-frame loop. */
export function createInventoryDrag(input: DragInput) {
	let dragSource = $state<InventoryDragSource>();
	let dropEntity = $state<string>();
	let pointerGesture:
		| {
				id: number;
				x: number;
				y: number;
				source: InventoryDragSource;
				dragging: boolean;
		  }
		| undefined;
	let dragScrollFrame: number | undefined;
	let pointerPosition: { clientX: number; clientY: number } | undefined;
	function stopDragScroll() {
		if (dragScrollFrame !== undefined) cancelAnimationFrame(dragScrollFrame);
		dragScrollFrame = undefined;
		pointerPosition = undefined;
	}
	function startDragScroll() {
		if (dragScrollFrame !== undefined) return;
		const scroll = () => {
			if (!pointerGesture?.dragging || !pointerPosition) {
				stopDragScroll();
				return;
			}
			// A phone can place the two grids several screens apart. Keeping a held
			// finger near an edge scrolls toward the destination without a Move mode.
			const edge = 72;
			const y = pointerPosition.clientY;
			const delta =
				y < edge
					? -Math.ceil((edge - y) / 5)
					: y > window.innerHeight - edge
						? Math.ceil((y - window.innerHeight + edge) / 5)
						: 0;
			if (delta) {
				// Desktop/tablet frames may own their scroll; phones scroll the document.
				// Give the nearest scrollable ancestor first chance, then the page.
				let container: HTMLElement | null | undefined = input.root();
				let scrolled = false;
				while (container && container !== document.body) {
					if (/(auto|scroll)/.test(getComputedStyle(container).overflowY)) {
						const before = container.scrollTop;
						container.scrollTop += delta;
						if (container.scrollTop !== before) {
							scrolled = true;
							break;
						}
					}
					container = container.parentElement;
				}
				if (!scrolled) window.scrollBy(0, delta);
				// Capture still delivers events to the source: refresh the destination
				// under the stationary finger as the content moves underneath it.
				const target = pointerTarget(pointerPosition);
				dropEntity =
					target && acceptsDrop(target) ? target.entityId : undefined;
			}
			dragScrollFrame = requestAnimationFrame(scroll);
		};
		dragScrollFrame = requestAnimationFrame(scroll);
	}
	let ignorePointerClick = false;

	const dragType = "application/x-stardew-backpack-item";
	function startDrag(event: DragEvent, item: InventorySlot) {
		const owner = input.ownerOf(item);
		if (
			!owner ||
			item.empty ||
			input.movePending() ||
			pointerGesture ||
			!event.dataTransfer
		) {
			event.preventDefault();
			return;
		}
		if (input.selectedEntity() !== item.entityId) input.choose(item.entityId);
		dragSource = {
			ownerId: owner.ownerId,
			entityId: item.entityId,
			location: isEquipment(item) ? item.key : "backpack",
		};
		// A drag carries only this panel's token. External text/files/windows cannot
		// manufacture an inventory operation, and saved item data never enters the payload.
		event.dataTransfer.setData(dragType, input.token);
		event.dataTransfer.effectAllowed = "move";
	}
	function acceptsDrop(item: InventorySlot) {
		const owner = input
			.owners()
			.find((owner) => owner.ownerId === dragSource?.ownerId);
		const source =
			owner &&
			allSlots(owner).find((entry) => entry.entityId === dragSource?.entityId);
		if (!source) return false;
		// Domain-projected equipment eligibility supplies only a cursor hint here.
		// The command rechecks both directions against current records at commit.
		if (
			isEquipment(item) &&
			(item.locked || !source.allowedEquipmentSlots.includes(item.key))
		)
			return false;
		return (
			!isEquipment(source) ||
			item.empty ||
			item.allowedEquipmentSlots.includes(source.key)
		);
	}
	function dragOver(event: DragEvent, item: InventorySlot) {
		if (
			!dragSource ||
			input.movePending() ||
			!event.dataTransfer?.types.includes(dragType)
		)
			return;
		event.preventDefault();
		event.dataTransfer.dropEffect = acceptsDrop(item) ? "move" : "none";
		dropEntity = acceptsDrop(item) ? item.entityId : undefined;
	}
	function drop(event: DragEvent, item: InventorySlot) {
		const source = dragSource;
		if (
			!source ||
			input.movePending() ||
			event.dataTransfer?.getData(dragType) !== input.token
		)
			return;
		event.preventDefault();
		input.move(item, source);
	}
	function pointerDown(event: PointerEvent, item: InventorySlot) {
		const owner = input.ownerOf(item);
		ignorePointerClick = false;
		if (
			!owner ||
			item.empty ||
			input.movePending() ||
			pointerGesture ||
			!["touch", "pen"].includes(event.pointerType)
		)
			return;
		// Touch/pen use the same drag operation as desktop, but wait for deliberate
		// movement so a tap still selects the item normally.
		pointerGesture = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			dragging: false,
			source: {
				ownerId: owner.ownerId,
				entityId: item.entityId,
				location: isEquipment(item) ? item.key : "backpack",
			},
		};
		const control = event.currentTarget;
		if (control instanceof HTMLElement)
			control.setPointerCapture?.(event.pointerId);
	}
	function pointerTarget(event: { clientX: number; clientY: number }) {
		const control = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest<HTMLElement>("[data-inventory-entity]");
		if (!control || !input.root()?.contains(control)) return undefined;
		return input
			.visibleOwners()
			.flatMap((owner) => (owner ? allSlots(owner) : []))
			.find((item) => item.entityId === control.dataset.inventoryEntity);
	}
	function pointerMove(event: PointerEvent) {
		const gesture = pointerGesture;
		if (!gesture || gesture.id !== event.pointerId) return;
		if (
			!gesture.dragging &&
			Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 8
		)
			return;
		if (!gesture.dragging) {
			if (input.selectedEntity() !== gesture.source.entityId)
				input.choose(gesture.source.entityId);
			gesture.dragging = true;
			dragSource = gesture.source;
		}
		event.preventDefault();
		pointerPosition = { clientX: event.clientX, clientY: event.clientY };
		startDragScroll();
		const target = pointerTarget(event);
		dropEntity = target && acceptsDrop(target) ? target.entityId : undefined;
	}
	function pointerUp(event: PointerEvent) {
		const gesture = pointerGesture;
		if (!gesture || gesture.id !== event.pointerId) return;
		pointerGesture = undefined;
		stopDragScroll();
		if (!gesture.dragging) return;
		// Hit-test the release position because pointer capture keeps delivery on
		// the source button. Suppress its synthetic click after a completed drag.
		ignorePointerClick = true;
		const target = pointerTarget(event);
		if (target) input.move(target, gesture.source);
		else {
			dragSource = undefined;
			dropEntity = undefined;
		}
	}
	function pointerCancel() {
		// Native mouse drag cancels its preceding pointer stream too; only a real
		// touch/pen gesture owns this cleanup, or desktop drag state would be lost.
		if (!pointerGesture) return;
		// Browser cancellation/scroll takeover must never publish a partial drag.
		pointerGesture = undefined;
		stopDragScroll();
		dragSource = undefined;
		dropEntity = undefined;
	}
	function clearHighlight() {
		// Explicit selection clears source/hover, not a pending touch gesture.
		// Its threshold handler still owns that captured pointer until up/cancel.
		dragSource = undefined;
		dropEntity = undefined;
	}
	return {
		get source() {
			return dragSource;
		},
		get targetId() {
			return dropEntity;
		},
		clearHighlight,
		startNative: startDrag,
		overNative: dragOver,
		dropNative: drop,
		leaveNative(item: InventorySlot) {
			if (dropEntity === item.entityId) dropEntity = undefined;
		},
		endNative: clearHighlight,
		pointerDown,
		pointerMove,
		pointerUp,
		pointerCancel,
		click(event: MouseEvent, item: InventorySlot) {
			if (ignorePointerClick && event.detail !== 0) {
				ignorePointerClick = false;
				return false;
			}
			input.choose(item.entityId);
			return true;
		},
		dispose() {
			stopDragScroll();
			pointerGesture = undefined;
			clearHighlight();
		},
	};
}
