import { getContext, setContext } from "svelte";

export class Toast {
	message: string;
	icon: string;

	constructor(message: string, type: "success" | "failure") {
		this.message = message;

		switch (type) {
			case "success":
				this.icon = "✅";
				break;
			case "failure":
				this.icon = "❌";
				break;
		}
	}
}

class ToastManager {
	#toasts = $state<Toast[]>([]);

	add(toast: Toast, duration = 5000) {
		this.toasts.push(toast);

		setTimeout(() => {
			this.#toasts = this.#toasts.filter((t) => t !== toast);
		}, duration);
	}

	get toasts() {
		return this.#toasts;
	}
}

const TOAST_KEY = Symbol("ToastManager");

export const setToastManager = () => setContext(TOAST_KEY, new ToastManager());

export const getToastManager = () => getContext<ToastManager>(TOAST_KEY);
