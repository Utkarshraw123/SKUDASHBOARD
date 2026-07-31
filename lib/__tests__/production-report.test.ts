import { describe, it, expect } from "vitest";
import { reportAuthorized } from "../production-report";

describe("reportAuthorized", () => {
  it("authorizes when a valid supervisor session is present, regardless of password", () => {
    expect(reportAuthorized(true, "", "12345")).toBe(true);
    expect(reportAuthorized(true, "wrong", "12345")).toBe(true);
  });
  it("authorizes without a session when the shared password matches (dashboard form)", () => {
    expect(reportAuthorized(false, "12345", "12345")).toBe(true);
  });
  it("rejects when there is no session and the password is wrong or missing", () => {
    expect(reportAuthorized(false, "", "12345")).toBe(false);
    expect(reportAuthorized(false, "nope", "12345")).toBe(false);
  });
});
