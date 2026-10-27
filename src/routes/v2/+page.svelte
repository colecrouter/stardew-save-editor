<script lang="ts">
	import { resolve } from "$app/paths";
	import { saveOriginalBackup } from "$lib/saveBackups";
	import EditorApp from "$lib/editor/ui/EditorApp.svelte";
</script>

<svelte:head><title>Calendar editor – Stardew Save Editor</title></svelte:head>

<EditorApp legacyHref={resolve("/")} backupOriginal={saveOriginalBackup} />
