import { describe, it, expect } from "vitest";
import { isAdmin } from "../adminOnly";
import type { SessionUser } from "../session";

const mk = (role: SessionUser["role"]): SessionUser => ({ id: 1, username: "u", name: "U", role });

describe("isAdmin", () => {
  it("is true only for admins", () => {
    expect(isAdmin(mk("admin"))).toBe(true);
    expect(isAdmin(mk("manager"))).toBe(false);
    expect(isAdmin(mk("supervisor"))).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
