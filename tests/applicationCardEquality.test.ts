import { describe, expect, it } from "vitest";
import { applicationCardPropsEqual } from "../src/lib/applicationCardEquality";
import { makeJobApplication } from "./fixtures/jobApplication";

describe("applicationCardPropsEqual", () => {
  it("treats identical display fields as equal", () => {
    const left = { application: makeJobApplication({ id: "a", title: "Engineer" }) };
    const right = {
      application: makeJobApplication({
        id: "a",
        title: "Engineer",
        fullJd: "<p>x</p>",
      }),
    };
    expect(applicationCardPropsEqual(left, right)).toBe(true);
  });

  it("detects updatedAt changes", () => {
    const left = { application: makeJobApplication({ id: "a", title: "Engineer" }) };
    const right = {
      application: makeJobApplication({
        id: "a",
        title: "Engineer",
        updatedAt: "2026-06-02T10:00:00.000Z",
      }),
    };
    expect(applicationCardPropsEqual(left, right)).toBe(false);
  });

  it("detects status and title changes", () => {
    const base = makeJobApplication({ id: "a", title: "Engineer" });
    expect(
      applicationCardPropsEqual(
        { application: base },
        { application: makeJobApplication({ id: "a", status: "offer" }) },
      ),
    ).toBe(false);
    expect(
      applicationCardPropsEqual({ application: base }, { application: makeJobApplication({ id: "a", title: "Lead" }) }),
    ).toBe(false);
  });
});
