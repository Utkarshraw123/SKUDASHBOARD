import { describe, it, expect } from "vitest";
import { validateNewUser, validateName } from "../adminValidate";

describe("validateNewUser", () => {
  it("accepts a well-formed user", () => {
    expect(validateNewUser({ username: "jane", name: "Jane", role: "supervisor", password: "secret1" })).toEqual([]);
  });
  it("requires username, name, valid role, and a 6+ char password", () => {
    const errs = validateNewUser({ username: "", name: "", role: "boss" as any, password: "x" });
    expect(errs).toContain("Username is required.");
    expect(errs).toContain("Name is required.");
    expect(errs).toContain("Role must be supervisor, manager, or admin.");
    expect(errs).toContain("Password must be at least 6 characters.");
  });
  it("rejects usernames with spaces", () => {
    expect(validateNewUser({ username: "a b", name: "A", role: "admin", password: "secret1" }))
      .toContain("Username cannot contain spaces.");
  });
});

describe("validateName", () => {
  it("requires a non-empty name", () => {
    expect(validateName("")).toContain("Name is required.");
    expect(validateName("Machine 3")).toEqual([]);
  });
});
