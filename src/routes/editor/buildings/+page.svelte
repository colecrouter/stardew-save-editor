<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import BuildingsPanel from "$lib/editor/ui/BuildingsPanel.svelte";

	const { model } = getEditorPanel();
</script>

<BuildingsPanel {model} />
