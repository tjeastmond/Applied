import { describe, expect, it } from "vitest";
import { filterApplications, hasActiveApplicationFilters } from "../src/lib/applicationFilters";
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

describe("applicationFilters", () => {
  it("detects active filters", () => {
    expect(
      hasActiveApplicationFilters({
        selectedCompanies: new Set(),
        selectedStatuses: new Set(),
        searchQuery: "",
      }),
    ).toBe(false);
    expect(
      hasActiveApplicationFilters({
        selectedCompanies: new Set(["Acme"]),
        selectedStatuses: new Set(),
        searchQuery: "",
      }),
    ).toBe(true);
  });

  it("composes company, status, and search filters", () => {
    const applications = [
      app({ id: "a", title: "Software Engineer", company: "Acme", status: "applied" }),
      app({ id: "b", title: "Software Engineer", company: "Beta", status: "offer" }),
      app({ id: "c", title: "Designer", company: "Acme", status: "applied" }),
    ];

    expect(
      filterApplications(applications, {
        selectedCompanies: new Set(["Acme"]),
        selectedStatuses: new Set(["applied"]),
        searchQuery: "engineer",
      }).map((item) => item.id),
    ).toEqual(["a"]);
  });
});
