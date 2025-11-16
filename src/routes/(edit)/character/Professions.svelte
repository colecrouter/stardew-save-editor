<script lang="ts" module>
	import { asset } from "$app/paths";
	import { Profession, skillGroups } from "$lib/proxies/Skills.svelte";
	const getSprite = (p: Profession) => {
		const x = (p % 6) * 16;
		const y = Math.floor(p / 6) * 16 + 624;
		return [x, y] as const;
	};
</script>

<script lang="ts">
	import { Professions } from "$lib/proxies/Skills.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";

	interface Props {
		professions: Professions;
	}

	let { professions }: Props = $props();

	const toggle = (p: Profession) =>
		professions.has(p) ? professions.delete(p) : professions.add(p);
</script>

{#snippet icon(p: Profession)}
	{@const [x, y] = getSprite(p)}
	<img
		src={asset("/assets/Cursors.png")}
		alt={Profession[p]}
		style:object-position="{-x}px {-y}px"
		class="profession-icon"
	/>
{/snippet}

<div class="professions-grid">
	{#each skillGroups as sg}
		<div class="skill-column">
			<h3>{sg.skill}</h3>
			<div class="level5">
				{#each sg.primary as p}
					<UiButton
						name="primary-{sg.skill}"
						alt={Profession[p]}
						checked={professions.has(p)}
						active={professions.has(p)}
						onclick={() => toggle(p)}
					>
						{@render icon(p)}
					</UiButton>
				{/each}
			</div>
			<div class="level10">
				{#each sg.primary as pr}
					{#each sg.secondary[pr] ?? [] as s}
						<UiButton
							name="secondary-{sg.skill}"
							alt={Profession[s]}
							active={professions.has(s)}
							disabled={!professions.has(pr)}
							onclick={() => toggle(s)}
						>
							{@render icon(s)}
						</UiButton>
					{/each}
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.professions-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
	}
	.skill-column {
		padding: 8px;
		border-radius: 4px;
		text-align: center;
	}
	.level5,
	.level10 {
		margin-top: 4px;
		display: flex;
		justify-content: space-evenly;
		gap: 8px;
	}
	.profession-icon {
		width: 16px;
		height: 16px;
		vertical-align: middle;
		object-fit: none;
	}
</style>
