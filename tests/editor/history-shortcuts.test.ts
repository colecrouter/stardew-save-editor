// @vitest-environment happy-dom
// These domain guards intentionally exercise real DOM event paths.
import { afterEach, expect, it } from "vitest";
import {
	historyShortcut,
	usesAppleShortcuts,
} from "../../src/lib/editor/history-shortcuts";

afterEach(() => {
	document.body.replaceChildren();
});

// Dispatch through real DOM paths so nested editable controls exercise browser
// event ownership rather than a mocked target that bypasses the guard.
function resolve(
	options: KeyboardEventInit = {},
	target: EventTarget = document.body,
	apple = false,
) {
	const event = new KeyboardEvent("keydown", {
		key: "z",
		ctrlKey: !apple,
		metaKey: apple,
		bubbles: true,
		composed: true,
		cancelable: true,
		...options,
	});
	let action: ReturnType<typeof historyShortcut>;
	const listener = (received: Event) => {
		if (received instanceof KeyboardEvent)
			action = historyShortcut(received, apple, document);
	};
	window.addEventListener("keydown", listener);
	try {
		target.dispatchEvent(event);
		return action;
	} finally {
		window.removeEventListener("keydown", listener);
	}
}

it("uses the platform's modifier and conventional redo alternatives", () => {
	expect(usesAppleShortcuts("MacIntel")).toBe(true);
	expect(usesAppleShortcuts("Win32")).toBe(false);
	expect(resolve()).toBe("undo");
	expect(resolve({ shiftKey: true })).toBe("redo");
	expect(resolve({ key: "y" })).toBe("redo");
	expect(resolve({}, document.body, true)).toBe("undo");
	expect(resolve({ key: "Z", shiftKey: true }, document.body, true)).toBe(
		"redo",
	);
	expect(resolve({ key: "y" }, document.body, true)).toBeUndefined();
	expect(resolve({ ctrlKey: false, metaKey: true })).toBeUndefined();
	expect(
		resolve({ ctrlKey: true, metaKey: false }, document.body, true),
	).toBeUndefined();
});

it.each([
	{ repeat: true },
	{ isComposing: true },
	{ altKey: true },
	{ metaKey: true },
	{ key: "s" },
	{ key: "y", shiftKey: true },
])("leaves unrelated or unsafe chords alone: %j", (options) => {
	expect(resolve(options)).toBeUndefined();
});

it.each([
	"<input>",
	'<input type="number">',
	"<textarea></textarea>",
	"<select></select>",
	'<div contenteditable="true"><span tabindex="0">text</span></div>',
	'<div role="textbox" tabindex="0"></div>',
])("preserves native input ownership: %s", (markup) => {
	document.body.innerHTML = markup;
	const target =
		document.querySelector("span") ?? document.body.firstElementChild;
	if (!(target instanceof HTMLElement))
		throw new Error("Missing editable test control");
	target.focus();
	expect(resolve({}, target)).toBeUndefined();
	expect(resolve({}, window)).toBeUndefined();
});

it("respects an earlier event handler and an editor inside a shadow root", () => {
	document.body.addEventListener("keydown", (event) => event.preventDefault(), {
		once: true,
	});
	expect(resolve()).toBeUndefined();
	const host = document.createElement("div");
	document.body.append(host);
	const root = host.attachShadow({ mode: "open" });
	const input = document.createElement("input");
	root.append(input);
	expect(resolve({}, input)).toBeUndefined();
});

it.each([
	"<dialog open></dialog>",
	'<div role="dialog" aria-modal="true"></div>',
	'<div role="alertdialog"></div>',
])("suspends history while a dialog is open: %s", (markup) => {
	document.body.innerHTML = markup;
	expect(resolve()).toBeUndefined();
});

it("ignores retained closed/hidden dialogs", () => {
	document.body.innerHTML =
		'<dialog></dialog><section hidden><div role="dialog"></div></section><div role="dialog" style="display:none"></div>';
	expect(resolve()).toBe("undo");
});

// Toggling a checkbox leaves it focused; save Undo must still reverse that edit.
it.each(["checkbox", "radio", "range"])(
	"allows save history from a focused %s",
	(type) => {
		const input = document.createElement("input");
		input.type = type;
		document.body.append(input);
		input.focus();
		expect(resolve({}, input)).toBe("undo");
	},
);
