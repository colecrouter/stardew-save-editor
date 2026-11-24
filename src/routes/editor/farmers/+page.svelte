<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";

	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import FarmerRosterPanel from "$lib/editor/ui/FarmerRosterPanel.svelte";

	const { model } = getEditorPanel();
	const view = useAtomValue(() => model.atomBindings.view);
</script>

{#if view.current}
	<FarmerRosterPanel
		{model}
		roster={view.current.farmerRoster}
		appearances={view.current.appearances}
	/>
{/if}
