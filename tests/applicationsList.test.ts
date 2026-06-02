import { describe, expect, it } from "vitest";
import { removeApplication, sortApplications, upsertApplication } from "../src/lib/applicationsList";
import type { JobApplication } from "../src/types";

function app(id: string, appliedAt: string, createdAt: string): JobApplication {
  return {
    id,
    url: `https://example.com/${id}`,
    linkedinUrl: null,
    title: id,
    company: "Co",
    appliedAt,
    viaRecruiter: false,
    recruiterName: null,
    recruiterFirm: null,
    contactEmail: null,
    contactPhone: null,
    fullJd: null,
    status: "applied",
    createdAt,
    updatedAt: createdAt,
  };
}

describe("applicationsList", () => {
  it("sorts by appliedAt then createdAt descending", () => {
    const sorted = sortApplications([
      app("a", "2026-06-01", "2026-06-01T10:00:00.000Z"),
      app("b", "2026-06-02", "2026-06-01T09:00:00.000Z"),
      app("c", "2026-06-02", "2026-06-01T11:00:00.000Z"),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["c", "b", "a"]);
  });

  it("upserts and removes applications", () => {
    const initial = [app("a", "2026-06-01", "2026-06-01T10:00:00.000Z")];
    const updated = app("a", "2026-06-03", "2026-06-03T10:00:00.000Z");
    const withNew = upsertApplication(initial, app("b", "2026-06-02", "2026-06-02T10:00:00.000Z"));

    expect(upsertApplication(initial, updated)[0]?.appliedAt).toBe("2026-06-03");
    expect(withNew.map((item) => item.id)).toEqual(["b", "a"]);
    expect(removeApplication(withNew, "a").map((item) => item.id)).toEqual(["b"]);
  });
});
