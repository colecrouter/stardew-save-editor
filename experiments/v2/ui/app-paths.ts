/** Resolve shared sprite URLs against the lab's public directory and Vite base. */
export const asset = (path: string) =>
	`${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
