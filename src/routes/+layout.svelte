<script lang="ts">
	import { beforeNavigate } from "$app/navigation";
	import { asset, resolve } from "$app/paths";
	import { updated, page } from "$app/state";
	import { setToastManager } from "$lib/ToastManager.svelte";
	import Toasts from "$lib/ui/Toasts.svelte";

	let { children } = $props();

	setToastManager();

	// A newer deployment can remove chunks referenced by this tab. Reload before
	// client-side navigation so its route manifest and modules come from one version.
	// Navigations already leaving the document need no intervention.
	beforeNavigate(({ to, willUnload }) => {
		if (updated.current && !willUnload && to?.url) {
			location.href = to.url.href;
		}
	});
</script>

<svelte:head>
	<!-- V2 lays out for the actual device width. Legacy screens retain their
	     existing zoom while their wider layouts are still in use. -->
	<meta
		name="viewport"
		content={page.route.id === "/"
			? "width=device-width, initial-scale=1"
			: "width=device-width, initial-scale=0.58"}
	/>
	<meta property="og:image" content={asset("img/summary.png")} />
	<link rel="icon" type="image/png" href={asset("img/favicon.png")} />
	<link rel="canonical" href={resolve("")} />
</svelte:head>

<!-- GITHUB LOGO -->
<a
	class:v2-repository={page.route.id === "/"}
	href="https://github.com/colecrouter/stardew-save-editor"
	aria-label="GitHub repository link"
	target="_blank"
	rel="noreferrer"
>
	<img src={asset("img/github.svg")} alt="GitHub Logo" />
</a>

<main class:calendar-workspace={page.route.id === "/"}>
	{@render children?.()}
</main>

<Toasts />

<!-- FOOTER -->
<small class:v2-credits={page.route.id === "/"}>
	Some assets utilized belong to ConcernedApe. Used under Fair Use and not
	affiliated with ConcernedApe or Stardew Valley
</small>

<style>
	@import "../root.css";

	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: start;
		padding-top: 5rem;
		min-height: 100%;
		padding-bottom: 4rem;
	}

	.calendar-workspace {
		padding: 0;
		flex: 1;
		min-height: 0;
		width: 100%;
	}

	/* Let the actual credit text reserve its own height, including wrapping.
	   Desktop gives the remaining space to the workbench; phones keep document scrolling. */
	:global(body:has(main.calendar-workspace)) {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}
	@media (min-width: 901px) {
		:global(body:has(.editor-application.has-session)) {
			height: 100dvh;
		}
	}
	.v2-credits {
		position: static;
		flex: none;
		z-index: auto;
		font-size: 12px;
		line-height: 1.3;
		padding: 4px 8px;
	}
	/* The original ribbon remains visible in the opposite corner from Close. */
	.v2-repository {
		left: 0;
		right: auto;
		z-index: 10;
	}
	.v2-repository::before {
		left: 0;
		right: auto;
		clip-path: polygon(0 0, 100% 0, 0 100%);
	}

	/* GitHub logo */
	a {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 1;
		padding: 0.5rem;
	}

	a > img {
		width: 2rem;
		height: 2rem;
		transition: filter 0.2s ease-in-out;
		image-rendering: auto !important;
		filter: invert(1);
	}

	a::before {
		/* top right wedge */
		content: "";
		position: absolute;
		top: 0;
		right: 0;
		height: 160%;
		width: 160%;
		background: #0008;
		clip-path: polygon(0% 0%, 100% 100%, 100% 0%);
	}

	a:hover > img {
		filter: invert(0.8);
	}

	small {
		position: absolute;
		bottom: 0;
		/* margin: 0.1rem; */
		z-index: -1;
		padding: 4px;
	}
</style>
