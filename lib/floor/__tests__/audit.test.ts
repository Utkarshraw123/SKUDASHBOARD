import { describe, it, expect } from "vitest";
import { diffFields } from "../audit";

describe("diffFields", () => {
  it("returns only changed fields as string old/new", () => {
    const before = { actualQty: 90, comments: "ok", plannedQty: 100 };
    const after = { actualQty: 95, comments: "ok", plannedQty: 100 };
    expect(diffFields(before, after, ["actualQty", "comments", "plannedQty"])).toEqual([
      { field: "actualQty", old: "90", new: "95" },
    ]);
  });
  it("treats null/undefined as empty string", () => {
    expect(diffFields({ a: null }, { a: 5 }, ["a"])).toEqual([{ field: "a", old: "", new: "5" }]);
  });
});
