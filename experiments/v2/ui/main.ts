import { mount } from "svelte";
import "./theme.css";

const target = document.getElementById("app");
if (!target) throw new Error("Missing app mount");
const editor = ["editor", "calendar"].includes(
	new URL(location.href).searchParams.get("flow") ?? "",
);
document.title = editor ? "V2 editing workspace" : "Inventory state experiment";
// Keep imports lazy while allowing each component's own props to be inferred.
const application = editor
	? import("./EditorApp.svelte").then(({ default: App }) =>
			mount(App, { target }),
		)
	: import("./App.svelte").then(({ default: App }) => mount(App, { target }));
void application.catch((error) => {
	target.textContent = `Unable to open the editor: ${String(error)}`;
});
