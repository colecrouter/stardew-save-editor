<script lang="ts">
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import QuestList from "./QuestList.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
</script>

<QuestList quests={save.qiQuests} />
