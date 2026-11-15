<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";

	import type { AdapterModel } from "./adapter-model.ts";

	let { model }: { model: AdapterModel } = $props();
	// This consumer intentionally mounts independently of the session. The browser
	// proof can detach every hook, edit the save, then inspect a fresh mount.

	const view = useAtomValue(() => model.atomBindings.view);
	const pending = useAtomValue(() => model.atomBindings.pending);
</script>

<output aria-label="Adapter day">
	{view.current?.calendar.date.day ?? "closed"}
</output>
<output aria-label="Adapter pending">{pending.current}</output>
