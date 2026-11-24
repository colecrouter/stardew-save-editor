<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import CommunityPanel from "$lib/editor/ui/CommunityPanel.svelte";

	const { model } = getEditorPanel();
</script>

<CommunityPanel {model} />
