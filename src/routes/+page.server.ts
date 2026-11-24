import { redirect } from "@sveltejs/kit";

import { resolve } from "$app/paths";

// Keep the public entry URL and prerender its redirect for GitHub Pages.
export function load() {
	redirect(307, resolve("/editor/calendar"));
}
