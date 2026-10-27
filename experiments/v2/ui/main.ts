import { mount } from "svelte";
import "./theme.css";

const target = document.getElementById("app");
if (!target) throw new Error("Missing app mount");
const editor = ["editor", "calendar"].includes(
	new URL(location.href).searchParams.get("flow") ?? "",
);
document.title = editor ? "V2 editing workspace" : "Inventory state experiment";
const application = editor
	? import("./EditorApp.svelte")
	: import("./App.svelte");
void application
	.then(({ default: App }) => mount(App, { target }))
	.catch((error) => {
		target.textContent = `Unable to open the editor: ${String(error)}`;
	});
