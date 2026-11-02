<script lang="ts">
	import "./styles.css";
	import type { Snippet } from "svelte";
	import StudyIcon from "../StudyIcon.svelte";
	let { title, children }: { title: string; children: Snippet } = $props();
	const id = $props.id();
</script>

<!-- Supplemental inline context stays in reading order, separate from live alerts
     and floating panels. It must not be the only place to disclose required input. -->
<aside class="study-kit study-aside" aria-labelledby={id}>
	<StudyIcon name="info" size={24} />

	<div>
		<h3 {id}>{title}</h3>

		{@render children()}
	</div>
</aside>
