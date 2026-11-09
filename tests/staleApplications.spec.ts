import { describe, expect, it } from "vitest";
import { countStaleApplications, isStaleApplication } from "@/lib/staleApplications";
import { makeJobApplication } from "./fixtures/jobApplication";

const now = new Date("2026-10-19T12:00:00Z");

describe("isStaleApplication", () => {
  it("flags eligible statuses not updated in two months", () => {
    expect(
      isStaleApplication(makeJobApplication({ id: "x", status: "applied", updatedAt: "2026-08-18T00:00:00Z" }), now),
    ).toBe(true);
    expect(
      isStaleApplication(
        makeJobApplication({ id: "x", status: "interviewing", updatedAt: "2026-06-01T00:00:00Z" }),
        now,
      ),
    ).toBe(true);
  });

  it("ignores recent, archived, and ineligible applications", () => {
    expect(
      isStaleApplication(makeJobApplication({ id: "x", status: "applied", updatedAt: "2026-09-01T00:00:00Z" }), now),
    ).toBe(false);
    expect(
      isStaleApplication(
        makeJobApplication({ id: "x", status: "applied", archived: true, updatedAt: "2026-01-01T00:00:00Z" }),
        now,
      ),
    ).toBe(false);
    for (const status of ["offer", "rejected", "passed", "to_apply"] as const) {
      expect(isStaleApplication(makeJobApplication({ id: "x", status, updatedAt: "2026-01-01T00:00:00Z" }), now)).toBe(
        false,
      );
    }
  });

  it("counts stale applications", () => {
    const apps = [
      makeJobApplication({ id: "a", status: "applied", updatedAt: "2026-01-01T00:00:00Z" }),
      makeJobApplication({ id: "b", status: "no_response", updatedAt: "2026-01-01T00:00:00Z" }),
      makeJobApplication({ id: "c", status: "applied", updatedAt: "2026-10-01T00:00:00Z" }),
    ];
    expect(countStaleApplications(apps, now)).toBe(2);
  });
});
