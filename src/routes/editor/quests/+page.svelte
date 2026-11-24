<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import QuestJournalPanel from "$lib/editor/ui/QuestJournalPanel.svelte";

	const { model } = getEditorPanel();
</script>

<QuestJournalPanel {model} />
