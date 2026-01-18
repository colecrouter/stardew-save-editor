import type { Weapon as WeaponInfo } from "$types/items";
import { ItemProxy } from "./ItemProxy";
import type { WeaponItemModel } from "./types";

export class WeaponProxy extends ItemProxy {
	constructor(raw: WeaponItemModel) {
		super(raw);
		this.ensureWeapon();
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

	private ensureWeapon(): asserts this is WeaponProxy & {
		readonly info: WeaponInfo;
	} {
		if (this.info?._type !== "Weapon") {
			throw new TypeError(`Item "${this.name}" is not a Weapon`);
		}
	}
}
