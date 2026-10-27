<script lang="ts">
	import ApplicationComponent from "../../../src/lib/editor/ui/CommandToasts.svelte";
	import type { ComponentProps } from "svelte";
	let props: ComponentProps<typeof ApplicationComponent> = $props();
</script>

<!-- The lab exercises the application component rather than owning another UI. -->
<ApplicationComponent {...props} />
