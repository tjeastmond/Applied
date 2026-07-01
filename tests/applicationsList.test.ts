import { describe, expect, it } from "vitest";
import { removeApplication, sortApplications, upsertApplication } from "../src/lib/applicationsList";
import { makeJobApplication } from "./fixtures/jobApplication";

describe("applicationsList", () => {
  it("sorts pinned applications first, then by updatedAt and createdAt descending", () => {
    const sorted = sortApplications([
      makeJobApplication({
        id: "a",
        appliedAt: "2026-06-01",
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      }),
      makeJobApplication({
        id: "b",
        pinned: true,
        appliedAt: "2026-06-02",
        createdAt: "2026-06-01T09:00:00.000Z",
        updatedAt: "2026-06-01T09:00:00.000Z",
      }),
      makeJobApplication({
        id: "c",
        appliedAt: "2026-06-02",
        createdAt: "2026-06-01T11:00:00.000Z",
        updatedAt: "2026-06-03T09:00:00.000Z",
      }),
      makeJobApplication({
        id: "d",
        pinned: true,
        appliedAt: "2026-06-02",
        createdAt: "2026-06-01T08:00:00.000Z",
        updatedAt: "2026-06-03T10:00:00.000Z",
      }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("upserts and removes applications", () => {
    const initial = [
      makeJobApplication({
        id: "a",
        appliedAt: "2026-06-01",
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      }),
    ];
    const updated = makeJobApplication({
      id: "a",
      appliedAt: "2026-06-03",
      createdAt: "2026-06-03T10:00:00.000Z",
      updatedAt: "2026-06-03T10:00:00.000Z",
    });
    const withNew = upsertApplication(
      initial,
      makeJobApplication({
        id: "b",
        appliedAt: "2026-06-02",
        createdAt: "2026-06-02T10:00:00.000Z",
        updatedAt: "2026-06-02T10:00:00.000Z",
      }),
    );

    expect(upsertApplication(initial, updated)[0]?.appliedAt).toBe("2026-06-03");
    expect(withNew.map((item) => item.id)).toEqual(["b", "a"]);
    expect(removeApplication(withNew, "a").map((item) => item.id)).toEqual(["b"]);
  });
});
