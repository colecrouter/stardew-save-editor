<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import ProgressPanel from "$lib/editor/ui/ProgressPanel.svelte";

	const { model } = getEditorPanel();
</script>

<ProgressPanel {model} />
