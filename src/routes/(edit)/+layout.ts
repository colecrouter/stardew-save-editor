import { base } from "$app/paths";
import { saveManager } from "$lib/SaveFile.svelte";
import { redirect } from "@sveltejs/kit";

export const load = async () => {
    if (!saveManager.saveData) return redirect(303, `${base}/`);
};