import { redirect } from "@sveltejs/kit";

import { dev } from "$app/env";
import { resolve } from "$app/paths";

export function load() {
	// Keep the workspace asset preview in development while the static build
	// can still prerender a destination for this route.
	if (!dev) redirect(307, resolve("/editor/calendar"));
}
