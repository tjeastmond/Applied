import { describe, expect, it } from "vitest";
import { filterApplicationsByCompanies, toggleCompanySelection, uniqueCompanyNames } from "../src/lib/companyFilter";
import { makeJobApplication } from "./fixtures/jobApplication";

describe("companyFilter", () => {
  it("lists unique trimmed company names in sort order", () => {
    expect(
      uniqueCompanyNames([
        makeJobApplication({ id: "a", company: "Zeta Corp" }),
        makeJobApplication({ id: "b", company: "  Acme  " }),
        makeJobApplication({ id: "c", company: "Acme" }),
        makeJobApplication({ id: "d", company: null }),
        makeJobApplication({ id: "e", company: "" }),
      ]),
    ).toEqual(["Acme", "Zeta Corp"]);
  });

  it("returns all applications when no companies are selected", () => {
    const applications = [
      makeJobApplication({ id: "a", company: "Acme" }),
      makeJobApplication({ id: "b", company: "Beta" }),
    ];
    expect(filterApplicationsByCompanies(applications, new Set())).toEqual(applications);
  });

  it("filters to selected companies only", () => {
    const applications = [
      makeJobApplication({ id: "a", company: "Acme" }),
      makeJobApplication({ id: "b", company: "Beta" }),
      makeJobApplication({ id: "c", company: "Acme" }),
    ];
    expect(filterApplicationsByCompanies(applications, new Set(["Acme"])).map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("toggles company selection", () => {
    const selected = toggleCompanySelection(new Set(), "Acme", true);
    expect([...selected]).toEqual(["Acme"]);
    expect([...toggleCompanySelection(selected, "Acme", false)]).toEqual([]);
  });
});
