export const nil = { "@_xsi:nil": "true" as const };
export type Nil = typeof nil;
export const isNil = (value: unknown): value is Nil =>
    typeof value === "object" && value !== null && "@_xsi:nil" in value;
