import type { Weapon as WeaponInfo } from "$types/items";
import type { WeaponItem } from "$types/save";
import { ItemProxy, Raw } from "./ItemProxy";

export class WeaponProxy extends ItemProxy<WeaponItem> {
	public minDamage: number | undefined;
	public maxDamage: number | undefined;
	public speed: number | undefined;
	public knockback: number | undefined;
	public critChance: number | undefined;
	public critMultiplier: number | undefined;
	public precision: number | undefined;
	public areaOfEffect: number | undefined;

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

		this.areaOfEffect = $state(this[Raw].addedAreaOfEffect);
		$effect(() => this.syncAreaOfEffect());
	}

	get isWeapon(): boolean {
		return this.info?._type === "Weapon";
	}

	get weaponInfo(): WeaponInfo {
		this.ensureWeapon();
		return this.info;
	}

	get statSummary(): Record<string, number | undefined> {
		this.ensureWeapon();
		return {
			minDamage: this.minDamage,
			maxDamage: this.maxDamage,
			speed: this.speed,
			knockback: this.knockback,
			critChance: this.critChance,
			critMultiplier: this.critMultiplier,
			precision: this.precision,
			areaOfEffect: this.areaOfEffect,
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

	private syncAreaOfEffect() {
		if (this.areaOfEffect === undefined) return;
		this[Raw].addedAreaOfEffect = this.areaOfEffect;
	}

	private ensureWeapon(): asserts this is WeaponProxy {
		if (this.info?._type !== "Weapon") {
			throw new TypeError(`Item "${this.name}" is not a Weapon`);
		}
	}
}
