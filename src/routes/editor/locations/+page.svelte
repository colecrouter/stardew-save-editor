<script lang="ts">
	import { getEditorPanel } from "$lib/editor/panel-context.ts";
	import LocationInspector from "$lib/editor/ui/LocationInspector.svelte";

	const { model } = getEditorPanel();
</script>

<LocationInspector {model} />
