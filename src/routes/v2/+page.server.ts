import { redirect } from "@sveltejs/kit";

import { resolve } from "$app/paths";

// Keep older V2 bookmarks pointing directly at the default panel.
export function load() {
	redirect(307, resolve("/editor/calendar"));
}
