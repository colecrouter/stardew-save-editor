<script lang="ts">
	import { resolve } from "$app/paths";
	import { SaveProcessingBrowser } from "$lib/editor/save-processing-browser.ts";
	import EditorApp from "$lib/editor/ui/EditorApp.svelte";
	import { saveOriginalBackup } from "$lib/saveBackups";
</script>

<svelte:head><title>Stardew Save Editor</title></svelte:head>

<EditorApp
	legacyHref={resolve("legacy")}
	backupOriginal={saveOriginalBackup}
	processingLayer={SaveProcessingBrowser}
/>
