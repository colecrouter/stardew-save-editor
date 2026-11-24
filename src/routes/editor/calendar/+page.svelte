<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import CalendarPanel from "$lib/editor/ui/CalendarPanel.svelte";

	const { model } = getEditorPanel();
</script>

<CalendarPanel {model} />
