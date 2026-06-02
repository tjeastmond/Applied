import { describe, expect, it } from "vitest";
import { normalizeJobTitle } from "@/lib/normalizeJobTitle";

describe("normalizeJobTitle", () => {
  it("removes the Y Combinator suffix", () => {
    expect(normalizeJobTitle("Founding Engineer | Y Combinator")).toBe("Founding Engineer");
  });

  it("trims whitespace before returning", () => {
    expect(normalizeJobTitle("  Staff Engineer | Y Combinator  ")).toBe("Staff Engineer");
  });

  it("leaves other titles unchanged", () => {
    expect(normalizeJobTitle("Senior Engineer")).toBe("Senior Engineer");
  });

  it("returns null for nullish input", () => {
    expect(normalizeJobTitle(null)).toBeNull();
    expect(normalizeJobTitle(undefined)).toBeNull();
  });
});
