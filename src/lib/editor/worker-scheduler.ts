import { Layer, Scheduler } from "effect";

// Effect yields a running fiber every 2048 operations so other fibers (here,
// RPC messages such as interrupts) get a turn. Outside Node it resumes through
// setTimeout(0), which browsers clamp to at least 4 ms once timers nest. A full
// save decode yields hundreds of times, so the clamp alone added ~3 s of idle
// time to every import and export, while the actual CPU work took ~0.35 s.
//
// A MessageChannel message is queued as a task without that clamp. We keep
// cooperative yielding rather than disabling it, so queued RPC messages are
// still processed between batches.
function makeMessageChannelYield() {
	const channel = new MessageChannel();
	// Callbacks run in the order they were scheduled. One posted message
	// corresponds to exactly one queued callback.
	const queue: Array<() => void> = [];
	channel.port1.addEventListener("message", () => queue.shift()?.());
	// Unlike assigning onmessage, a listener does not open the port's message
	// queue, so start it explicitly or no scheduled callback would ever run.
	channel.port1.start();
	return (task: () => void) => {
		// Cancellation cannot withdraw a posted message, so a cancelled entry
		// stays queued and is skipped when its message arrives.
		let cancelled = false;
		queue.push(() => {
			if (!cancelled) task();
		});
		channel.port2.postMessage(undefined);
		return () => {
			cancelled = true;
		};
	};
}

// Worker entry points provide this to every fiber they launch. Runtimes without
// MessageChannel keep Effect's default scheduler.
export const WorkerSchedulerLive =
	typeof MessageChannel === "undefined"
		? Layer.empty
		: Layer.succeed(
				Scheduler.Scheduler,
				new Scheduler.MixedScheduler("async", makeMessageChannelYield()),
			);
