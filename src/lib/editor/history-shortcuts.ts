/** Browser-owned keyboard policy; commands and their error handling stay in the workspace. */
export type HistoryAction = "undo" | "redo";

/** Match desktop Apple conventions, including iPad keyboards reporting a Mac platform. */
export const usesAppleShortcuts = (platform: string) =>
	/Mac|iPhone|iPad|iPod/i.test(platform);

/** Resolve a history gesture only after native controls and dialogs have had priority. */
export function historyShortcut(
	event: KeyboardEvent,
	apple: boolean,
	document: Document,
): HistoryAction | undefined {
	// Composition, held-key repetition and handled events must not drain save history.
	// Accept only the platform modifier; Alt/AltGr and mixed Ctrl+Meta belong elsewhere.
	if (
		event.defaultPrevented ||
		event.isComposing ||
		event.repeat ||
		event.altKey
	)
		return;
	if (apple ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey)
		return;
	const key = event.key.toLowerCase();
	const action =
		key === "z"
			? event.shiftKey
				? "redo"
				: "undo"
			: !apple && key === "y" && !event.shiftKey
				? "redo"
				: undefined;
	if (!action) return;

	// Use the composed path for shadow-hosted controls and also inspect focus when
	// a shortcut is dispatched at the window. Any editable ancestor owns native Undo.
	const targets = [...event.composedPath(), document.activeElement];
	if (
		targets.some(
			(target) =>
				target instanceof Element &&
				(target.matches(
					'textarea, select, [role="textbox"], [role="combobox"], [role="spinbutton"]',
				) ||
					// Discrete input controls have no text Undo stack. Let their last
					// change be undone without requiring the user to move focus away.
					(target instanceof HTMLInputElement &&
						![
							"checkbox",
							"radio",
							"button",
							"submit",
							"reset",
							"image",
							"range",
							"color",
							"file",
						].includes(target.type)) ||
					(target instanceof HTMLElement && target.isContentEditable) ||
					target.matches('[contenteditable]:not([contenteditable="false"])')),
		)
	)
		return;

	// Native and portaled kit dialogs both suspend workspace history. Closed or
	// hidden retained panels do not count as an active dialog.
	const dialogs = document.querySelectorAll(
		'dialog[open], [role="dialog"], [role="alertdialog"]',
	);
	if (
		[...dialogs].some(
			(dialog) =>
				!dialog.closest('[hidden], [inert], [aria-hidden="true"]') &&
				document.defaultView?.getComputedStyle(dialog).display !== "none",
		)
	)
		return;
	return action;
}
