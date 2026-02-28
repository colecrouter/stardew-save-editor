import type { WeaponItem } from "$types/save";
import { BaseItemProxy, Raw } from "./ItemProxy.svelte";

export class WeaponProxy extends BaseItemProxy<WeaponItem> {
	public minDamage: number | undefined;
	public maxDamage: number | undefined;
	public speed: number | undefined;
	public knockback: number | undefined;
	public critChance: number | undefined;
	public critMultiplier: number | undefined;
	public precision: number | undefined;
	public defense: number | undefined;
	public areaOfEffect: number | undefined;
	public appearance: string | undefined;

	constructor(raw: WeaponItem) {
		super(raw);
		this.ensureWeapon();

		this.minDamage = $state(this[Raw].minDamage);
		$effect(() => this.syncMinDamage());

		this.maxDamage = $state(this[Raw].maxDamage);
		$effect(() => this.syncMaxDamage());

		this.speed = $state(this[Raw].speed);
		$effect(() => this.syncSpeed());

		this.knockback = $state(this[Raw].knockback);
		$effect(() => this.syncKnockback());

		this.critChance = $state(this[Raw].critChance);
		$effect(() => this.syncCritChance());

		this.critMultiplier = $state(this[Raw].critMultiplier);
		$effect(() => this.syncCritMultiplier());

		this.precision = $state(this[Raw].addedPrecision);
		$effect(() => this.syncPrecision());

		this.defense = $state(this[Raw].addedDefense);
		$effect(() => this.syncDefense());

		this.areaOfEffect = $state(this[Raw].addedAreaOfEffect);
		$effect(() => this.syncAreaOfEffect());

		this.appearance = $state(this[Raw].appearance);
		$effect(() => this.syncAppearance());
	}

	get statSummary() {
		this.ensureWeapon();
		return {
			minDamage: this.minDamage,
			maxDamage: this.maxDamage,
			speed: this.speed,
			knockback: this.knockback,
			critChance: this.critChance,
			critMultiplier: this.critMultiplier,
			precision: this.precision,
			defense: this.defense,
			areaOfEffect: this.areaOfEffect,
			appearance: this.appearance,
		};
	}

	private syncMinDamage() {
		if (this.minDamage === undefined) return;
		this[Raw].minDamage = this.minDamage;
	}

	private syncMaxDamage() {
		if (this.maxDamage === undefined) return;
		this[Raw].maxDamage = this.maxDamage;
	}

	private syncSpeed() {
		if (this.speed === undefined) return;
		this[Raw].speed = this.speed;
	}

	private syncKnockback() {
		if (this.knockback === undefined) return;
		this[Raw].knockback = this.knockback;
	}

	private syncCritChance() {
		if (this.critChance === undefined) return;
		this[Raw].critChance = this.critChance;
	}

	private syncCritMultiplier() {
		if (this.critMultiplier === undefined) return;
		this[Raw].critMultiplier = this.critMultiplier;
	}

	private syncPrecision() {
		if (this.precision === undefined) return;
		this[Raw].addedPrecision = this.precision;
	}

	private syncDefense() {
		if (this.defense === undefined) return;
		this[Raw].addedDefense = this.defense;
	}

	private syncAreaOfEffect() {
		if (this.areaOfEffect === undefined) return;
		this[Raw].addedAreaOfEffect = this.areaOfEffect;
	}

	private syncAppearance() {
		this[Raw].appearance = this.appearance;
	}

	private ensureWeapon(): asserts this is WeaponProxy {
		if (this.info?._type !== "Weapon") {
			throw new TypeError(`Item "${this.name}" is not a Weapon`);
		}
	}
}
