import { describe, expect, it } from "vitest";
import {
  applicationMatchesViewMode,
  archiveViewToggleLabel,
  bulkArchiveConfirmDescription,
  countArchivableApplications,
  nextViewMode,
  partitionApplicationsByView,
  statusFiltersForViewMode,
} from "@/lib/applicationArchive";
import { makeJobApplication } from "./fixtures/jobApplication";

describe("partitionApplicationsByView", () => {
  it("returns only non-archived applications in active view", () => {
    const applications = [
      makeJobApplication({ id: "a", archived: false }),
      makeJobApplication({ id: "b", archived: true }),
    ];

    expect(partitionApplicationsByView(applications, "active").map((item) => item.id)).toEqual(["a"]);
  });

  it("returns only archived applications in archived view", () => {
    const applications = [
      makeJobApplication({ id: "a", archived: false }),
      makeJobApplication({ id: "b", archived: true }),
    ];

    expect(partitionApplicationsByView(applications, "archived").map((item) => item.id)).toEqual(["b"]);
  });
});

describe("applicationMatchesViewMode", () => {
  it("matches archived state to the current view mode", () => {
    const archived = makeJobApplication({ id: "a", archived: true });
    const active = makeJobApplication({ id: "b", archived: false });

    expect(applicationMatchesViewMode(archived, "archived")).toBe(true);
    expect(applicationMatchesViewMode(active, "archived")).toBe(false);
    expect(applicationMatchesViewMode(active, "active")).toBe(true);
    expect(applicationMatchesViewMode(archived, "active")).toBe(false);
  });
});

describe("countArchivableApplications", () => {
  it("counts non-archived rejected and passed applications", () => {
    const applications = [
      makeJobApplication({ id: "a", status: "rejected", archived: false }),
      makeJobApplication({ id: "b", status: "passed", archived: false }),
      makeJobApplication({ id: "c", status: "rejected", archived: true }),
      makeJobApplication({ id: "d", status: "applied", archived: false }),
    ];

    expect(countArchivableApplications(applications)).toBe(2);
  });
});

describe("archive view helpers", () => {
  it("toggles view mode and status filters consistently", () => {
    expect(nextViewMode("active")).toBe("archived");
    expect(nextViewMode("archived")).toBe("active");
    expect(statusFiltersForViewMode("archived")).toEqual(new Set(["rejected", "passed"]));
    expect(statusFiltersForViewMode("active").size).toBe(0);
    expect(archiveViewToggleLabel("active")).toBe("View archived applications");
    expect(archiveViewToggleLabel("archived")).toBe("Back to active applications");
  });

  it("formats bulk archive confirmation copy", () => {
    expect(bulkArchiveConfirmDescription(1)).toContain("1 rejected or passed application");
    expect(bulkArchiveConfirmDescription(3)).toContain("3 rejected and passed applications");
  });
});
