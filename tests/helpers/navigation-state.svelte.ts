// Navigation regression tests need rune-backed state: a fixed snapshot cannot
// reveal components that stop reacting after Kit updates the current page.
export const page = $state({
	url: new URL("http://localhost/stardew-save-editor/"),
	route: { id: "/" },
});

export const updated = $state({ current: false });

// A loaded legacy save is sufficient for redirect policy; parsing its contents is
// covered elsewhere. Changes here must still notify the layout's reactive effect.
export const saveManager = $state<{ save: { raw: object } | undefined }>({
	save: undefined,
});

// Exercise the same layouts at the origin root and beneath the production base.
export const deployment = { base: "/stardew-save-editor" };
