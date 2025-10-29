import { getContext, setContext } from "svelte";

export class Toast {
	public message: string;
	public icon: string;
	readonly id: string;

	constructor(message: string, type: "success" | "failure") {
		this.message = message;
		this.id = window.crypto.randomUUID();

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

export class ToastManager {
	#toasts = $state<Toast[]>([]);

	add(toast: Toast, duration = 5000) {
		this.toasts.push(toast);

		setTimeout(() => {
			this.#toasts = this.#toasts.filter((t) => t.id !== toast.id);
		}, duration);
	}

	get toasts() {
		return this.#toasts;
	}
}

const TOAST_KEY = Symbol("ToastManager");

export const setToastManager = () => setContext(TOAST_KEY, new ToastManager());

export const getToastManager = () => getContext<ToastManager>(TOAST_KEY);

export const setToastManagerContext = (manager: ToastManager) =>
	new Map([[TOAST_KEY, manager]]);
