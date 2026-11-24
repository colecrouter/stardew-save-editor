<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import QiOrdersPanel from "$lib/editor/ui/QiOrdersPanel.svelte";

	const { model } = getEditorPanel();
</script>

<QiOrdersPanel {model} />
