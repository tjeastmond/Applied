import { describe, expect, it } from "vitest";
import { applicationCardPropsEqual } from "../src/lib/applicationCardEquality";
import type { JobApplication } from "../src/types";

function app(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "a",
    url: "https://example.com/a",
    linkedinUrl: null,
    title: "Engineer",
    company: "Acme",
    appliedAt: "2026-06-01",
    viaRecruiter: false,
    recruiterName: null,
    recruiterFirm: null,
    contactEmail: null,
    contactPhone: null,
    fullJd: null,
    status: "applied",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("applicationCardPropsEqual", () => {
  it("treats identical display fields as equal", () => {
    const left = { application: app() };
    const right = { application: app({ updatedAt: "2026-06-02T10:00:00.000Z", fullJd: "<p>x</p>" }) };
    expect(applicationCardPropsEqual(left, right)).toBe(true);
  });

  it("detects status and title changes", () => {
    expect(
      applicationCardPropsEqual({ application: app() }, { application: app({ status: "offer" }) }),
    ).toBe(false);
    expect(
      applicationCardPropsEqual({ application: app() }, { application: app({ title: "Lead" }) }),
    ).toBe(false);
  });
});
