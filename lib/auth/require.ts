import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE, type SessionUser, type Role } from "./session";

// Pure resolver (testable without request context).
export async function resolveUser(token: string | undefined): Promise<SessionUser | null> {
  return getSessionUser(token);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return resolveUser(cookies().get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/floor/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/floor/login");
  return user;
}
