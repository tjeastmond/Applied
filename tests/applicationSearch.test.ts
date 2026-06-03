import { describe, expect, it } from "vitest";
import { filterApplicationsBySearch } from "../src/lib/applicationSearch";
import type { JobApplication } from "../src/types";

function app(overrides: Partial<JobApplication> & Pick<JobApplication, "id">): JobApplication {
  return {
    id: overrides.id,
    url: overrides.url ?? `https://example.com/${overrides.id}`,
    linkedinUrl: overrides.linkedinUrl ?? null,
    title: overrides.title ?? overrides.id,
    company: overrides.company ?? "Acme",
    appliedAt: overrides.appliedAt ?? "2026-06-01",
    viaRecruiter: overrides.viaRecruiter ?? false,
    recruiterName: overrides.recruiterName ?? null,
    recruiterFirm: overrides.recruiterFirm ?? null,
    contactEmail: overrides.contactEmail ?? null,
    contactPhone: overrides.contactPhone ?? null,
    fullJd: overrides.fullJd ?? null,
    status: overrides.status ?? "applied",
    createdAt: overrides.createdAt ?? "2026-06-01T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-01T10:00:00.000Z",
  };
}

describe("applicationSearch", () => {
  it("returns all applications when search query is empty", () => {
    const applications = [app({ id: "a" }), app({ id: "b" })];
    expect(filterApplicationsBySearch(applications, "")).toEqual(applications);
  });

  it("matches title, company, url, and recruiter fields", () => {
    const applications = [
      app({ id: "a", title: "Engineer" }),
      app({ id: "b", company: "Globex" }),
      app({ id: "c", url: "https://jobs.example.com/backend" }),
      app({ id: "d", recruiterName: "Jordan Lee" }),
    ];
    expect(filterApplicationsBySearch(applications, "engineer").map((item) => item.id)).toEqual(["a"]);
    expect(filterApplicationsBySearch(applications, "globex").map((item) => item.id)).toEqual(["b"]);
    expect(filterApplicationsBySearch(applications, "backend").map((item) => item.id)).toEqual(["c"]);
    expect(filterApplicationsBySearch(applications, "jordan").map((item) => item.id)).toEqual(["d"]);
  });
});
