<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import FarmPanel from "$lib/editor/ui/FarmPanel.svelte";

	const { model } = getEditorPanel();
</script>

<FarmPanel {model} />
