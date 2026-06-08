import { describe, expect, it } from "vitest";
import { filterApplicationsByStatuses, toggleStatusSelection } from "../src/lib/statusFilter";
import { makeJobApplication } from "./fixtures/jobApplication";

describe("statusFilter", () => {
  it("returns all applications when no statuses are selected", () => {
    const applications = [
      makeJobApplication({ id: "a", status: "applied" }),
      makeJobApplication({ id: "b", status: "offer" }),
    ];
    expect(filterApplicationsByStatuses(applications, new Set())).toEqual(applications);
  });

  it("filters to selected statuses only", () => {
    const applications = [
      makeJobApplication({ id: "a", status: "applied" }),
      makeJobApplication({ id: "b", status: "offer" }),
      makeJobApplication({ id: "c", status: "applied" }),
    ];
    expect(filterApplicationsByStatuses(applications, new Set(["applied"])).map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("toggles status selection", () => {
    const selected = toggleStatusSelection(new Set(), "applied", true);
    expect([...selected]).toEqual(["applied"]);
    expect([...toggleStatusSelection(selected, "applied", false)]).toEqual([]);
  });
});
