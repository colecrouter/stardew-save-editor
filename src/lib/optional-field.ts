// Required fields cannot be cleared through this helper. Keep the selected key
// tied to its own field type rather than widening all optional field values.
type NamedFields<T extends object> = {
	[
		K in keyof T as string extends K ? never : number extends K ? never : K
	]: T[K];
};
// Generated saves permit opaque extension keys. Those broad indexes must not
// hide whether a declared field is required, even if its value allows undefined.
type OptionalKey<T extends object> = {
	[K in keyof NamedFields<T>]-?: {} extends Pick<NamedFields<T>, K> ? K : never;
}[keyof NamedFields<T>];

/** Undefined means an absent serialized field, while null remains an explicit
 * saved value. Callers can reset optional fields without storing own undefined
 * properties or weakening the generated save representation. */
export function writeOptionalField<
	T extends object,
	K extends keyof T & OptionalKey<T>,
>(target: T, key: K, value: T[K]): void {
	if (value === undefined) delete target[key];
	else target[key] = value;
}
