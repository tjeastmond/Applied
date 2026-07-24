import { describe, expect, it } from "vitest";
import { toggleSetSelection } from "../src/lib/toggleSetSelection";

describe("toggleSetSelection", () => {
  it("adds and removes values", () => {
    const selected = toggleSetSelection(new Set<string>(), "Acme", true);
    expect([...selected]).toEqual(["Acme"]);
    expect([...toggleSetSelection(selected, "Acme", false)]).toEqual([]);
  });
});
