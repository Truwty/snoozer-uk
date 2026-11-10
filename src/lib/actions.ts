export type ActionState = { message: string; status: "idle" | "error" | "success" };
export const initialState: ActionState = { message: "", status: "idle" };
