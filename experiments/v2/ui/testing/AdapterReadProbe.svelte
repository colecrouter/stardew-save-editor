<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import { untrack } from "svelte";
	import type { EditorModel } from "../../editor-model.ts";
	let { model }: { model: EditorModel } = $props();
	// This consumer intentionally mounts independently of the session. The browser
	// proof can detach every hook, edit the save, then inspect a fresh mount.
	const bindings = untrack(() => model.atomBindings);
	const view = useAtomValue(bindings.view);
	const pending = useAtomValue(bindings.pending);
</script>

<output aria-label="Adapter day">
	{view.current?.calendar.date.day ?? "closed"}
</output>
<output aria-label="Adapter pending">{pending.current}</output>
