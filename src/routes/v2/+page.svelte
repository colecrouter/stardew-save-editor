<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	// Existing bookmarks reach the default editor without opening a second session.
	onMount(() => {
		void goto(resolve("/"), { replaceState: true });
	});
</script>

<a href={resolve("/")}>Open the editor</a>
