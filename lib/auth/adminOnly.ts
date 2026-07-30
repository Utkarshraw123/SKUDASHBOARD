import { getCurrentUser } from "./require";
import type { SessionUser } from "./session";

export function isAdmin(user: SessionUser | null): boolean {
  return !!user && user.role === "admin";
}

// Returns the admin SessionUser, or null if the caller is not an authenticated admin.
export async function adminOnly(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return isAdmin(user) ? user : null;
}
