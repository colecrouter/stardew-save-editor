<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import CharacterPanel from "$lib/editor/ui/CharacterPanel.svelte";

	const { model } = getEditorPanel();
</script>

<CharacterPanel {model} />
