<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import BackpackPanel from "$lib/editor/ui/BackpackPanel.svelte";

	const { model } = getEditorPanel();
</script>

<BackpackPanel {model} />
