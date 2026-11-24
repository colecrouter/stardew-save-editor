<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import PetsPanel from "$lib/editor/ui/PetsPanel.svelte";

	const { model } = getEditorPanel();
</script>

<PetsPanel {model} />
