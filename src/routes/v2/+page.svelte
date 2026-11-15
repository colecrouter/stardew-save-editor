<script lang="ts">
	import { onMount } from "svelte";

	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	// Existing bookmarks reach the default editor without opening a second session.
	onMount(() => {
		void goto(resolve(""), { replace: true });
	});
</script>

<a href={resolve("")}>Open the editor</a>
