import { beforeEach, vi } from "vitest";

/** Targeted drag-controller tests dispatch synthetic PointerEvents, which do
 * not create the active browser pointer required by native capture. Mock only
 * capture bookkeeping in those suites; real driver interactions retain it. */
export function installSyntheticPointerCapture() {
	beforeEach(() => {
		const capture = vi
			.spyOn(Element.prototype, "setPointerCapture")
			.mockImplementation(() => {});
		const release = vi
			.spyOn(Element.prototype, "releasePointerCapture")
			.mockImplementation(() => {});
		return () => {
			capture.mockRestore();
			release.mockRestore();
		};
	});
}
