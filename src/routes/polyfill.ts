export {};

const iteratorPrototype = Object.getPrototypeOf(
	Object.getPrototypeOf([][Symbol.iterator]()),
);
if (!iteratorPrototype) {
	throw new Error("Iterator prototype not found; cannot install shims.");
}

const makeIterator = <T>(next: () => IteratorResult<T>) => ({
	next,
	[Symbol.iterator]() {
		return this;
	},
});

// biome-ignore lint/complexity/noBannedTypes: <explanation>
const define = (name: "filter" | "some", value: Function) => {
	if (!(name in iteratorPrototype)) {
		Object.defineProperty(iteratorPrototype, name, {
			value,
			configurable: true,
			writable: true,
		});
	}
};

define("filter", function filter<
	T,
>(this: Iterator<T>, predicate: (value: T, index: number) => boolean) {
	if (typeof predicate !== "function")
		throw new TypeError("predicate must be callable");
	const source =
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		typeof (this as any)[Symbol.iterator] === "function"
			? // biome-ignore lint/suspicious/noExplicitAny: <explanation>
				(this as any)[Symbol.iterator]()
			: this;
	let index = 0;
	return makeIterator<T>(() => {
		while (true) {
			const { value, done } = source.next();
			if (done) return { value: undefined, done: true };
			try {
				if (predicate(value, index++)) return { value, done: false };
			} catch (error) {
				if (typeof source.return === "function") {
					try {
						source.return();
					} catch {
						/* ignore cleanup errors */
					}
				}
				throw error;
			}
		}
	});
});

define("some", function some<
	T,
>(this: Iterator<T>, predicate: (value: T, index: number) => boolean) {
	if (typeof predicate !== "function")
		throw new TypeError("predicate must be callable");
	const source =
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		typeof (this as any)[Symbol.iterator] === "function"
			? // biome-ignore lint/suspicious/noExplicitAny: <explanation>
				(this as any)[Symbol.iterator]()
			: this;
	let index = 0;
	while (true) {
		const { value, done } = source.next();
		if (done) return false;
		if (predicate(value, index++)) return true;
	}
});
