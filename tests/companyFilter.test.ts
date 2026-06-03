import { describe, expect, it } from "vitest";
import {
  filterApplicationsByCompanies,
  toggleCompanySelection,
  uniqueCompanyNames,
} from "../src/lib/companyFilter";
import type { JobApplication } from "../src/types";

function app(id: string, company: string | null): JobApplication {
  return {
    id,
    url: `https://example.com/${id}`,
    linkedinUrl: null,
    title: id,
    company,
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
  };
}

describe("companyFilter", () => {
  it("lists unique trimmed company names in sort order", () => {
    expect(
      uniqueCompanyNames([
        app("a", "Zeta Corp"),
        app("b", "  Acme  "),
        app("c", "Acme"),
        app("d", null),
        app("e", ""),
      ]),
    ).toEqual(["Acme", "Zeta Corp"]);
  });

  it("returns all applications when no companies are selected", () => {
    const applications = [app("a", "Acme"), app("b", "Beta")];
    expect(filterApplicationsByCompanies(applications, new Set())).toEqual(applications);
  });

  it("filters to selected companies only", () => {
    const applications = [app("a", "Acme"), app("b", "Beta"), app("c", "Acme")];
    expect(filterApplicationsByCompanies(applications, new Set(["Acme"])).map((item) => item.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("toggles company selection", () => {
    const selected = toggleCompanySelection(new Set(), "Acme", true);
    expect([...selected]).toEqual(["Acme"]);
    expect([...toggleCompanySelection(selected, "Acme", false)]).toEqual([]);
  });
});
