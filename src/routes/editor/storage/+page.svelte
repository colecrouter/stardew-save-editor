<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import StoragePanel from "$lib/editor/ui/StoragePanel.svelte";

	const { model } = getEditorPanel();
</script>

<StoragePanel {model} />
