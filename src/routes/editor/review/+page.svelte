<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import ReviewPanel from "$lib/editor/ui/ReviewPanel.svelte";

	const { model } = getEditorPanel();
</script>

<ReviewPanel {model} active={true} />
