interface TargetLocation {
	/** Session identity, retained through moves and never reused for a replacement. */
	id: string;
	context: string;
	outdoors: boolean;
}
export type WateringTarget = TargetLocation &
	(
		| { kind: "soil"; value: number | undefined }
		| { kind: "bowl"; value: boolean | undefined }
	);

/** Serializable domain state; it owns no references into the editable document. */
export type WateringMark = { id: string; context: string } & (
	| { kind: "soil"; before?: number }
	| { kind: "bowl"; before?: boolean }
);
export type WateringWrite = { id: string } & (
	| { kind: "soil"; value: number | undefined }
	| { kind: "bowl"; value: boolean | undefined }
);

/** Prepare one context's rain transition. Callers publish writes and provenance together. */
export function planRainWatering({
	targets,
	provenance,
	context,
	wasRaining,
	raining,
}: {
	targets: readonly WateringTarget[];
	provenance: readonly WateringMark[];
	context: string;
	wasRaining: boolean;
	raining: boolean;
}): { writes: WateringWrite[]; provenance: WateringMark[] } {
	const byId = new Map<string, WateringTarget>();
	for (const target of targets) {
		if (byId.has(target.id))
			throw new Error(`Duplicate watering target: ${target.id}`);
		byId.set(target.id, target);
	}
	const marked = new Set<string>();
	for (const mark of provenance) {
		if (marked.has(mark.id))
			throw new Error(`Duplicate watering provenance: ${mark.id}`);
		marked.add(mark.id);
	}
	const next = provenance.map((mark) => ({ ...mark }));
	if (wasRaining === raining) return { writes: [], provenance: next };
	const writes: WateringWrite[] = [];
	const affected = (target: WateringTarget) =>
		target.context === context && target.outdoors;
	if (raining) {
		for (const target of targets) {
			if (!affected(target)) continue;
			if (target.kind === "soil") {
				if (target.value === 1 || target.value === 2) continue;
				writes.push({ id: target.id, kind: "soil", value: 1 });
				if (!marked.has(target.id))
					next.push({
						id: target.id,
						context,
						kind: "soil",
						...(target.value === undefined ? {} : { before: target.value }),
					});
			} else {
				if (target.value === true) continue;
				writes.push({ id: target.id, kind: "bowl", value: true });
				if (!marked.has(target.id))
					next.push({
						id: target.id,
						context,
						kind: "bowl",
						...(target.value === undefined ? {} : { before: target.value }),
					});
			}
		}
		return { writes, provenance: next };
	}
	for (const mark of provenance) {
		if (mark.context !== context) continue;
		const target = byId.get(mark.id);
		// Removed/replaced targets, other weather contexts, and intervening edits
		// must never be changed by restoring an earlier watering operation.
		if (!target || !affected(target)) continue;
		if (mark.kind === "soil" && target.kind === "soil" && target.value === 1)
			writes.push({ id: mark.id, kind: "soil", value: mark.before });
		if (mark.kind === "bowl" && target.kind === "bowl" && target.value === true)
			writes.push({ id: mark.id, kind: "bowl", value: mark.before });
	}
	return {
		writes,
		provenance: next.filter((mark) => mark.context !== context),
	};
}
