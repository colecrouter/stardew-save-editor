<script lang="ts">
	import type { ImmediateField } from "../../immediate-field.ts";
	import SelectField from "./SelectField.svelte";

	let { field }: { field: ImmediateField<string> } = $props();
</script>

{#if (field.options?.length ?? 0) > 1 || field.reason}
	<div class="farmer">
		<SelectField {field} inline />
	</div>
{/if}

<style>
	.farmer {
		max-width: 360px;
	}
	@media (max-width: 600px) {
		.farmer {
			font-size: 17px;
			max-width: 210px;
		}
	}
</style>
