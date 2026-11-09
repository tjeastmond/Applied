import { describe, expect, it } from "vitest";
import { normalizeJobTitle } from "@/lib/normalizeJobTitle";

describe("normalizeJobTitle", () => {
  it("removes the Y Combinator suffix", () => {
    expect(normalizeJobTitle("Founding Engineer | Y Combinator")).toBe("Founding Engineer");
  });

  it("removes the Simplify suffix", () => {
    expect(normalizeJobTitle("Software Engineer at Acme | Simplify")).toBe("Software Engineer");
  });

  it("removes the Work at a Startup suffix", () => {
    expect(normalizeJobTitle("Software Engineer  at MindFort | Y Combinator's Work at a Startup")).toBe(
      "Software Engineer",
    );
  });

  it("removes the at CompanyName suffix", () => {
    expect(normalizeJobTitle("Lead Full-Stack Engineer at Roame")).toBe("Lead Full-Stack Engineer");
  });

  it("trims whitespace before returning", () => {
    expect(normalizeJobTitle("  Staff Engineer | Y Combinator  ")).toBe("Staff Engineer");
  });

  it("collapses double spaces in titles", () => {
    expect(normalizeJobTitle("Senior  Engineer   at  Acme")).toBe("Senior Engineer");
  });

  it("leaves other titles unchanged", () => {
    expect(normalizeJobTitle("Senior Engineer")).toBe("Senior Engineer");
  });

  it("returns null for nullish input", () => {
    expect(normalizeJobTitle(null)).toBeNull();
    expect(normalizeJobTitle(undefined)).toBeNull();
  });

  it("removes a company suffix that contains commas and periods", () => {
    expect(normalizeJobTitle("Sr Back End Software Engineer at Lively, Inc.")).toBe("Sr Back End Software Engineer");
  });

  it("removes the Job Application for prefix", () => {
    expect(
      normalizeJobTitle(
        "Job Application for Principal Software Engineer, Collaborative Web Platform at Pantheon Systems, Inc",
      ),
    ).toBe("Principal Software Engineer, Collaborative Web Platform");
  });

  describe("with a company", () => {
    it("removes a leading company name", () => {
      expect(normalizeJobTitle("TeamSnap - Staff Backend Engineer", "TeamSnap")).toBe("Staff Backend Engineer");
      expect(normalizeJobTitle("Entefy - Senior Backend Software Engineer (Remote Position)", "Entefy")).toBe(
        "Senior Backend Software Engineer (Remote Position)",
      );
    });

    it("removes a trailing company name", () => {
      expect(normalizeJobTitle("Staff Software Engineer - CircleCI", "CircleCI")).toBe("Staff Software Engineer");
      expect(normalizeJobTitle("Staff Software Engineer | circleci", "CircleCI")).toBe("Staff Software Engineer");
    });

    it("leaves role-team separators alone when they are not the company", () => {
      expect(normalizeJobTitle("Staff Engineer - Platform", "Rula")).toBe("Staff Engineer - Platform");
    });

    it("does not strip the whole title when it equals the company", () => {
      expect(normalizeJobTitle("Acme", "Acme")).toBe("Acme");
    });

    it("treats regex characters in the company name literally", () => {
      expect(normalizeJobTitle("Engineer - A.B (Co)", "A.B (Co)")).toBe("Engineer");
      expect(normalizeJobTitle("Engineer - AxB (Co)", "A.B (Co)")).toBe("Engineer - AxB (Co)");
    });
  });
});
