<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import RelationshipPanel from "$lib/editor/ui/RelationshipPanel.svelte";

	const { model } = getEditorPanel();
</script>

<RelationshipPanel {model} />
