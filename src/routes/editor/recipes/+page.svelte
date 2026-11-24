<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import RecipesPanel from "$lib/editor/ui/RecipesPanel.svelte";

	const { model } = getEditorPanel();
</script>

<RecipesPanel {model} />
