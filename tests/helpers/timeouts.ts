// Deadlines guard against stuck tests, rather than measuring acceptable latency.
// Keep full-save worker round trips within the same budget as ordinary tests so
// individual suites never need to choose their own machine-dependent deadline.
export const testTimeouts = {
	test: 120_000,
	hook: 30_000,
	assertion: 30_000,
};
