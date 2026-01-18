<script lang="ts">
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import Profiles from "./Profiles.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
</script>

<UiContainer>
	<h2>Drag and drop to reorder your farmhands</h2>

	<div class="wrapper">
		<UiContainerSmall>
			<Profiles bind:farmers={save.players} />
		</UiContainerSmall>
	</div>
</UiContainer>

<style>
	h2 {
		font-size: large;
		text-align: center;
		margin-bottom: 1em;
		padding-top: 0;
	}

	.wrapper {
		display: flex;
		width: 100%;
		justify-content: center;
	}
</style>
