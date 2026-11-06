<script lang="ts">
	import "./styles.css";
	import type { Snippet } from "svelte";
	import StudyIcon from "../StudyIcon.svelte";
	let {
		title,
		tone = "info",
		live,
		children,
	}: {
		title: string;
		tone?: "info" | "success" | "warning" | "danger";
		live?: "polite" | "assertive";
		children: Snippet;
	} = $props();
	const icons = {
		info: "notice-info",
		success: "check",
		warning: "warning",
		danger: "error",
	} as const;
</script>

<!-- Static notices do not announce on every mount. Callers opt into live feedback
     for dynamic outcomes; the icon is redundant with the explicit text heading. -->
<div
	class={["study-kit", "study-notice", `study-notice--${tone}`]}
	role={live === "assertive"
		? "alert"
		: live === "polite"
			? "status"
			: undefined}
>
	<StudyIcon name={icons[tone]} size={28} />

	<div>
		<h3 class="study-notice-title">{title}</h3>

		<div class="study-notice-body">{@render children()}</div>
	</div>
</div>
