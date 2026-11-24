import { redirect } from "@sveltejs/kit";

import { resolve } from "$app/paths";

// Open Calendar when the URL names the editor without a panel.
export function load() {
	redirect(307, resolve("/editor/calendar"));
}
