import { describe, expect, it } from "vitest";
import { filterApplications, hasActiveApplicationFilters } from "../src/lib/applicationFilters";
import { makeJobApplication } from "./fixtures/jobApplication";

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
    expect(
      hasActiveApplicationFilters({
        selectedCompanies: new Set(),
        selectedStatuses: new Set(),
        searchQuery: "",
        viewMode: "archived",
      }),
    ).toBe(true);
    expect(
      hasActiveApplicationFilters({
        selectedCompanies: new Set(),
        selectedStatuses: new Set(),
        searchQuery: "",
        includeArchived: true,
      }),
    ).toBe(true);
  });

  it("applies company, status, and search filters together", () => {
    const applications = [
      makeJobApplication({ id: "a", company: "Acme", status: "applied", title: "Engineer" }),
      makeJobApplication({ id: "b", company: "Beta", status: "offer", title: "Designer" }),
      makeJobApplication({ id: "c", company: "Acme", status: "offer", title: "Engineer" }),
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
