import { describe, expect, it } from "vitest";
import {
  companyIdFromPath,
  companyPath,
  deriveCompanyContacts,
  filterCompanies,
  findCompanyByName,
  isCompaniesRoute,
} from "@/lib/companies";
import type { Company, JobApplication } from "@/types";

function company(overrides: Partial<Company> & Pick<Company, "id" | "name">): Company {
  return {
    ignored: false,
    url: null,
    linkedinUrl: null,
    email: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterCompanies", () => {
  const companies = [
    company({ id: "1", name: "Acme", ignored: false }),
    company({ id: "2", name: "Blocked Co", ignored: true }),
  ];

  it("includes ignored companies on the main companies view", () => {
    expect(filterCompanies(companies, "", "active")).toHaveLength(2);
  });

  it("shows only ignored companies on the ignored view", () => {
    expect(filterCompanies(companies, "", "ignored")).toEqual([companies[1]]);
  });

  it("filters by search across all companies on the main view", () => {
    expect(filterCompanies(companies, "blocked", "active")).toEqual([companies[1]]);
  });
});

describe("company paths", () => {
  it("builds and parses company detail paths", () => {
    expect(companyPath("abc-123")).toBe("/companies/abc-123");
    expect(companyIdFromPath("/companies/abc-123")).toBe("abc-123");
    expect(companyIdFromPath("/companies/abc-123/")).toBe("abc-123");
    expect(companyIdFromPath(companyPath("a/b"))).toBe("a/b");
  });

  it("returns null for list and unrelated routes", () => {
    expect(companyIdFromPath("/companies")).toBeNull();
    expect(companyIdFromPath("/companies/")).toBeNull();
    expect(companyIdFromPath("/companies/ignored")).toBeNull();
    expect(companyIdFromPath("/analytics")).toBeNull();
    expect(companyIdFromPath("/companies/a/b")).toBeNull();
  });

  it("treats detail pages as companies routes", () => {
    expect(isCompaniesRoute("/companies")).toBe(true);
    expect(isCompaniesRoute("/companies/ignored")).toBe(true);
    expect(isCompaniesRoute("/companies/abc")).toBe(true);
    expect(isCompaniesRoute("/companiesx")).toBe(false);
  });
});

describe("findCompanyByName", () => {
  const companies = [company({ id: "1", name: "Acme Inc" }), company({ id: "2", name: "Beta" })];

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(findCompanyByName(companies, "  acme inc ")?.id).toBe("1");
  });

  it("returns null when missing or blank", () => {
    expect(findCompanyByName(companies, "Gamma")).toBeNull();
    expect(findCompanyByName(companies, "  ")).toBeNull();
  });
});

describe("deriveCompanyContacts", () => {
  function app(overrides: Partial<JobApplication>): JobApplication {
    return {
      id: "x",
      url: "https://example.com/job",
      title: "Engineer",
      company: "Acme",
      recruiterName: null,
      recruiterFirm: null,
      contactEmail: null,
      contactPhone: null,
      ...overrides,
    } as JobApplication;
  }

  it("skips applications without contact info", () => {
    expect(deriveCompanyContacts([app({})])).toEqual([]);
  });

  it("dedupes by email, merging fields and source titles", () => {
    const contacts = deriveCompanyContacts([
      app({ title: "A", recruiterName: "Pat", contactEmail: "Pat@x.com" }),
      app({ title: "B", recruiterFirm: "Firm", contactEmail: "pat@x.com", contactPhone: "555" }),
    ]);
    expect(contacts).toEqual([
      { name: "Pat", firm: "Firm", email: "Pat@x.com", phone: "555", sourceTitles: ["A", "B"] },
    ]);
  });

  it("dedupes by lowercased name when there is no email", () => {
    const contacts = deriveCompanyContacts([
      app({ title: "A", recruiterName: "Sam" }),
      app({ title: "B", recruiterName: "sam" }),
      app({ title: "C", recruiterName: "Lee" }),
    ]);
    expect(contacts).toHaveLength(2);
    expect(contacts[0].sourceTitles).toEqual(["A", "B"]);
  });
});
