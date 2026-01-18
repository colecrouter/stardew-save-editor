<script lang="ts">
	import { Raw } from "$lib/proxies";
	import { MailFlag } from "$lib/proxies/Mail.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import Bundle from "./Bundle.svelte";
	import JojaBundles from "./JojaBundles.svelte";

	const save = getSaveManager().save;
	const bundles = save?.communityBundles;
	const cc = save?.locations.find((l) => l[Raw].name === "CommunityCenter");
	if (!save || !bundles) throw new Error("No save data found");

	let hasJojaMembership = $derived(
		save.players.some((player) => player.mailReceived.has(MailFlag.JojaMember)),
	);

	function enableJojaMembership() {
		// IMPORTANT: mailReceived is a SvelteSet; do NOT replace the Set instance
		// or we lose reactivity. Mutate it directly so hasJojaMembership updates.
		for (const player of save?.players ?? []) {
			player.mailReceived.add(MailFlag.JojaMember);
			console.log("Enabled Joja Membership for player:", player.name);
		}
	}

	function disableJojaMembership() {
		for (const player of save?.players ?? []) {
			player.mailReceived.delete(MailFlag.JojaMember);
			console.log("Disabled Joja Membership for player:", player.name);
		}
	}
</script>

<UiContainer>
	<div class="warning">
		<h2>Under Construction 🏗️</h2>
		<p>Parts of this page are still being worked on.</p>
	</div>

	<h1>Community Bundles</h1>

	<!-- Enable or disable Joja Membership -->
	<label class="member-menu" data-testid="joja-toggle">
		<UiCheckbox
			type="checkbox"
			checked={hasJojaMembership}
			data-testid="joja-membership-checkbox"
			onchange={() => {
				if (hasJojaMembership) {
					disableJojaMembership();
				} else {
					enableJojaMembership();
				}
			}}
		/>
		Enable Joja Membership
	</label>

	{#if hasJojaMembership}
		{#if cc}
			<JojaBundles {save} {bundles} />
		{/if}
	{:else}
		<div class="wrapper" data-testid="bundle-wrapper">
			{#each Array.from(bundles.values()).toSorted((a, b) => a.id - b.id) as bundle}
				<Bundle {bundle} />
			{/each}
		</div>
	{/if}
</UiContainer>

<style>
	.member-menu {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.warning {
		background-color: rgba(255, 0, 0, 0.35);
		border-left: solid 4px rgba(255, 0, 0, 0.7);
	}

	.warning > * {
		padding: 0.2rem;
		padding-left: 0.5rem;
		margin-block-start: 0.2em;
		margin-block-end: 0.2em;
	}

	.wrapper {
		height: 320px;
		overflow-y: auto;
	}
</style>
