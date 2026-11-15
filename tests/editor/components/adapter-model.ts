import type { Atom, AtomRegistry } from "effect/reactivity";

/** The adapter probe reads these bindings; no command/session services are needed. */
export interface AdapterModel {
	atomBindings: {
		registry: AtomRegistry.AtomRegistry;
		view: Atom.Atom<
			| { readonly calendar: { readonly date: { readonly day: number } } }
			| undefined
		>;
		pending: Atom.Atom<number>;
	};
}
