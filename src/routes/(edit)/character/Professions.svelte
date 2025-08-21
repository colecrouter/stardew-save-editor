<script lang="ts" module>
	// Define profession groups by skill and unlock level
	const skillGroups = [
		{
			name: "Farming",
			primary: [Profession.Rancher, Profession.Tiller],
			secondary: {
				[Profession.Rancher]: [Profession.Coopmaster, Profession.Shepherd],
				[Profession.Tiller]: [Profession.Artisan, Profession.Agriculturist],
			},
		},
		{
			name: "Fishing",
			primary: [Profession.Fisher, Profession.Trapper],
			secondary: {
				[Profession.Fisher]: [Profession.Angler, Profession.Pirate],
				[Profession.Trapper]: [Profession.Mariner, Profession.Luremaster],
			},
		},
		{
			name: "Foraging",
			primary: [Profession.Forester, Profession.Gatherer],
			secondary: {
				[Profession.Forester]: [Profession.Lumberjack, Profession.Tapper],
				[Profession.Gatherer]: [Profession.Botanist, Profession.Tracker],
			},
		},
		{
			name: "Mining",
			primary: [Profession.Miner, Profession.Geologist],
			secondary: {
				[Profession.Miner]: [Profession.Blacksmith, Profession.Prospector],
				[Profession.Geologist]: [Profession.Excavator, Profession.Gemologist],
			},
		},
		{
			name: "Combat",
			primary: [Profession.Fighter, Profession.Scout],
			secondary: {
				[Profession.Fighter]: [Profession.Brute, Profession.Defender],
				[Profession.Scout]: [Profession.Acrobat, Profession.Desperado],
			},
		},
	] as {
		name: string;
		primary: Profession[];
		secondary: Partial<Record<Profession, Profession[]>>; // changed to allow missing keys
	}[];

	const getSprite = (p: Profession) => {
		const x = (p % 6) * 16;
		const y = Math.floor(p / 6) * 16 + 624; // 624 is the offset for professions in the sprite sheet
		return [x, y] as const;
	};
</script>

<script lang="ts">
	import { Profession } from "$lib/proxies/Professions";
	import type { Skills } from "$lib/proxies/Skills.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";

	interface Props {
		skills: Skills;
		professions: Set<Profession>;
	}

	let { skills, professions = $bindable() }: Props = $props();

	const toggle = (p: Profession) => {
		const s = new Set(professions);
		if (s.has(p)) {
			s.delete(p);

			// Delete secondary professions if primary is removed
			for (const sg of skillGroups) {
				if (sg.primary.includes(p)) {
					for (const secondary of sg.secondary[p] || []) {
						s.delete(secondary);
					}
				}
			}
			professions = new Set(s); // Ensure reactivity
		} else {
			s.add(p);
			professions = new Set(s); // Ensure reactivity
		}
	};
</script>

{#snippet icon(p: Profession)}
	{@const [x, y] = getSprite(p)}
	<img
		src={`/assets/Cursors.png`}
		alt={Profession[p]}
		style:object-position="{-x}px {-y}px"
		class="profession-icon"
	/>
{/snippet}

<div class="professions-grid">
	{#each skillGroups as sg}
		<div class="skill-column">
			<h3>{sg.name}</h3>
			<div class="level5">
				{#each sg.primary as p}
					<UiButton
						name="primary-{sg.name}"
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
							name="secondary-{sg.name}"
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
	label {
		margin-bottom: 0.25rem;
		cursor: pointer;
	}
	.profession-icon {
		width: 16px;
		height: 16px;
		vertical-align: middle;
		object-fit: none;
	}
</style>
