import { describe, expect, it } from "vitest";
import { filterAgentApplicationsBySearch, filterApplicationsBySearch } from "../src/lib/applicationSearch";
import type { AgentApplicationSummary } from "@/lib/schemas/agent";
import { makeJobApplication } from "./fixtures/jobApplication";

function makeSummary(overrides: Partial<AgentApplicationSummary> = {}): AgentApplicationSummary {
  return {
    id: "app-1",
    url: "https://jobs.example.com/role",
    status: "applied",
    title: "Engineer",
    company: "Acme",
    appliedAt: "2026-06-01",
    updatedAt: "2026-06-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("applicationSearch", () => {
  it("returns all applications when search query is empty", () => {
    const applications = [makeJobApplication({ id: "a" }), makeJobApplication({ id: "b" })];
    expect(filterApplicationsBySearch(applications, "")).toEqual(applications);
  });

  it("matches title, company, url, and recruiter fields", () => {
    const applications = [
      makeJobApplication({ id: "a", title: "Engineer" }),
      makeJobApplication({ id: "b", company: "Globex" }),
      makeJobApplication({ id: "c", url: "https://jobs.example.com/backend" }),
      makeJobApplication({ id: "d", recruiterName: "Jordan Lee" }),
    ];
    expect(filterApplicationsBySearch(applications, "engineer").map((item) => item.id)).toEqual(["a"]);
    expect(filterApplicationsBySearch(applications, "globex").map((item) => item.id)).toEqual(["b"]);
    expect(filterApplicationsBySearch(applications, "backend").map((item) => item.id)).toEqual(["c"]);
    expect(filterApplicationsBySearch(applications, "jordan").map((item) => item.id)).toEqual(["d"]);
  });
});

describe("filterAgentApplicationsBySearch", () => {
  it("returns all applications when search query is empty", () => {
    const applications = [makeSummary({ id: "a" }), makeSummary({ id: "b" })];
    expect(filterAgentApplicationsBySearch(applications, "")).toEqual(applications);
  });

  it("matches title, company, URL, status value, status label, and applied date", () => {
    const applications = [
      makeSummary({ id: "a", title: "Backend Engineer" }),
      makeSummary({ id: "b", company: "Globex" }),
      makeSummary({ id: "c", url: "https://jobs.example.com/designer" }),
      makeSummary({ id: "d", status: "interviewing" }),
      makeSummary({ id: "e", status: "to_apply" }),
      makeSummary({ id: "f", appliedAt: "2026-05-15" }),
    ];

    expect(filterAgentApplicationsBySearch(applications, "backend").map((item) => item.id)).toEqual(["a"]);
    expect(filterAgentApplicationsBySearch(applications, "globex").map((item) => item.id)).toEqual(["b"]);
    expect(filterAgentApplicationsBySearch(applications, "designer").map((item) => item.id)).toEqual(["c"]);
    expect(filterAgentApplicationsBySearch(applications, "interviewing").map((item) => item.id)).toEqual(["d"]);
    expect(filterAgentApplicationsBySearch(applications, "to apply").map((item) => item.id)).toEqual(["e"]);
    expect(filterAgentApplicationsBySearch(applications, "2026-05-15").map((item) => item.id)).toEqual(["f"]);
  });
});
