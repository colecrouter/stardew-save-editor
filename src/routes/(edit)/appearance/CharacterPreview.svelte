<script lang="ts">
import type { Farmer } from "$lib/proxies/Farmer.svelte";
import Character from "./Character.svelte";

interface Props {
	player: Farmer;
}

let { player }: Props = $props();
</script>

<div class="wrapper">
	<div class="inner">
		<Character {player} />
	</div>
</div>

<style>
	.wrapper {
		position: relative;
		width: 50px;
		height: 90px;
		margin: 6px;
	}

	.wrapper::before {
		content: "";
		position: absolute;
		background-image: url(/assets/daybg.png);
		background-size: cover;
		background-position: center;
		width: 100%;
		height: 100%;
		padding: 6px 0;
		margin-top: -6px;
	}

	.wrapper::after {
		content: "";
		position: absolute;
		top: 0;
		width: 100%;
		height: 100%;
		box-shadow:
			0 0 0 2px #8e3d04,
			0 0 0 4px #d97804,
			0 0 0 6px #5b2b29;
		border-radius: 2px;
	}

	.inner {
		display: flex;
		justify-content: center;
	}
</style>
