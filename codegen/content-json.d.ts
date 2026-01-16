type ContentRecord<T> = Record<string, T>;

type ObjectEntry = {
	Name?: string;
	ID?: string;
	DisplayName?: string;
	Description?: string;
	Texture?: string | null;
	SpriteIndex?: number;
	SheetIndex?: number;
	MenuSpriteIndex?: number;
	Price?: number;
	Type?: string | number;
	Category?: string | number;
	DefaultColor?: unknown;
	SalePrice?: number;
	CanBePlacedIndoors?: boolean;
	CanBePlacedOutdoors?: boolean;
	IsLamp?: boolean;
	Edibility?: number;
	ContextTags?: string[];
};

type BigCraftableEntry = {
	Name?: string;
	ID?: string;
	DisplayName?: string;
	Description?: string;
	Texture?: string | null;
	SpriteIndex?: number;
	SheetIndex?: number;
	MenuSpriteIndex?: number;
	Price?: number;
	IsLamp?: boolean;
};

type MannequinEntry = {
	Name?: string;
	ID?: string;
	DisplayName?: string;
	Description?: string;
	Texture?: string | null;
	SpriteIndex?: number;
	SheetIndex?: number;
};

type PantsEntry = {
	Name?: string;
	ID?: string;
	DisplayName?: string;
	Description?: string;
	Texture?: string | null;
	SpriteIndex?: number;
	SheetIndex?: number;
	Price?: number;
	ContextTags?: string[];
};

type ShirtEntry = {
	Name?: string;
	ID?: string;
	DisplayName?: string;
	Description?: string;
	Texture?: string | null;
	SpriteIndex?: number;
	SheetIndex?: number;
	Price?: number;
	HasSleeves?: boolean;
	ContextTags?: string[];
};

type ToolEntry = {
	Name?: string;
	ID?: string;
	DisplayName?: string;
	Description?: string;
	Texture?: string | null;
	SpriteIndex?: number;
	SheetIndex?: number;
	MenuSpriteIndex?: number;
	Price?: number;
	UpgradeLevel?: number;
	AttachmentSlots?: number;
	ClassName?: string;
};

type TrinketEntry = {
	Name?: string;
	ID?: string;
	DisplayName?: string;
	Description?: string;
	Texture?: string | null;
	SpriteIndex?: number;
	SheetIndex?: number;
	Price?: number;
};

type WeaponEntry = {
	Name?: string;
	ID?: string;
	DisplayName?: string;
	Description?: string;
	Texture?: string | null;
	SpriteIndex?: number;
	SheetIndex?: number;
	Price?: number;
	MinDamage?: number;
	MaxDamage?: number;
	Speed?: number;
	Knockback?: number;
	CritChance?: number;
	CritMultiplier?: number;
	AreaOfEffect?: number;
	Precision?: number;
};

declare module "*/content/Data/Objects.json" {
	const data: ContentRecord<ObjectEntry>;
	export default data;
}

declare module "*/content/Data/BigCraftables.json" {
	const data: ContentRecord<BigCraftableEntry>;
	export default data;
}

declare module "*/content/Data/Mannequins.json" {
	const data: ContentRecord<MannequinEntry>;
	export default data;
}

declare module "*/content/Data/Pants.json" {
	const data: ContentRecord<PantsEntry>;
	export default data;
}

declare module "*/content/Data/Shirts.json" {
	const data: ContentRecord<ShirtEntry>;
	export default data;
}

declare module "*/content/Data/Tools.json" {
	const data: ContentRecord<ToolEntry>;
	export default data;
}

declare module "*/content/Data/Trinkets.json" {
	const data: ContentRecord<TrinketEntry>;
	export default data;
}

declare module "*/content/Data/Weapons.json" {
	const data: ContentRecord<WeaponEntry>;
	export default data;
}
