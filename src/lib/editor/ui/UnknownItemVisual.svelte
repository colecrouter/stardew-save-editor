<script lang="ts">
	// Keep this presentation-only component typed for consumers outside the app's
	// Svelte workspace as well as the production route.
</script>

<!-- A missing picture must remain visibly different from an empty slot. This
     decorative fallback never implies that the saved item can be repaired. -->
<svg
	class="unknown-item"
	aria-hidden="true"
	width="32"
	height="32"
	viewBox="0 0 16 16"
	shape-rendering="crispEdges"
>
	<title>Unknown or unreadable item. Saved data is preserved.</title>
	<path d="M3 1h10v1h1v12h-1v1H3v-1H2V2h1Z" fill="#694621" />
	<path d="M3 2h10v12H3Z" fill="#fff2d3" />
	<path d="M5 4h5v1h1v3h-1v1H9v2H7V8h2V6H7v1H5Zm2 8h2v1H7Z" fill="#694621" />
</svg>
