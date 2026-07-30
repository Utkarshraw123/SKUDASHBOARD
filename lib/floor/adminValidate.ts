import type { Role } from "@/lib/auth/session";

const ROLES: Role[] = ["supervisor", "manager", "admin"];

export function validateNewUser(input: { username: string; name: string; role: Role; password: string }): string[] {
  const errs: string[] = [];
  if (!input.username.trim()) errs.push("Username is required.");
  else if (/\s/.test(input.username)) errs.push("Username cannot contain spaces.");
  if (!input.name.trim()) errs.push("Name is required.");
  if (!ROLES.includes(input.role)) errs.push("Role must be supervisor, manager, or admin.");
  if (!input.password || input.password.length < 6) errs.push("Password must be at least 6 characters.");
  return errs;
}

export function validateName(name: string): string[] {
  return name.trim() ? [] : ["Name is required."];
}
