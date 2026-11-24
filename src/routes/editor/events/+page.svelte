<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import EventsPanel from "$lib/editor/ui/EventsPanel.svelte";

	const { model } = getEditorPanel();
</script>

<EventsPanel {model} />
