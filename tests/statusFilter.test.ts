import { describe, expect, it } from "vitest";
import { filterApplicationsByStatuses, toggleStatusSelection } from "../src/lib/statusFilter";
import type { JobApplication } from "../src/types";

function app(id: string, status: JobApplication["status"]): JobApplication {
  return {
    id,
    url: `https://example.com/${id}`,
    linkedinUrl: null,
    title: id,
    company: "Acme",
    appliedAt: "2026-06-01",
    viaRecruiter: false,
    recruiterName: null,
    recruiterFirm: null,
    contactEmail: null,
    contactPhone: null,
    fullJd: null,
    status,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
  };
}

describe("statusFilter", () => {
  it("returns all applications when no statuses are selected", () => {
    const applications = [app("a", "applied"), app("b", "offer")];
    expect(filterApplicationsByStatuses(applications, new Set())).toEqual(applications);
  });

  it("filters to selected statuses only", () => {
    const applications = [app("a", "applied"), app("b", "offer"), app("c", "applied")];
    expect(filterApplicationsByStatuses(applications, new Set(["applied"])).map((item) => item.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("toggles status selection", () => {
    const selected = toggleStatusSelection(new Set(), "applied", true);
    expect([...selected]).toEqual(["applied"]);
    expect([...toggleStatusSelection(selected, "applied", false)]).toEqual([]);
  });
});
