import { describe, expect, it } from "vitest";
import { appViewToPath, appViewToQuery, computeNavCounts, pathToAppView } from "@/lib/appView";
import { makeJobApplication } from "./fixtures/jobApplication";

describe("appView", () => {
  it("maps paths to views", () => {
    expect(pathToAppView("/")).toBe("applications");
    expect(pathToAppView("/bookmarks")).toBe("bookmarks");
    expect(pathToAppView("/archived")).toBe("archived");
  });

  it("maps views to paths", () => {
    expect(appViewToPath("applications")).toBe("/");
    expect(appViewToPath("bookmarks")).toBe("/bookmarks");
    expect(appViewToPath("archived")).toBe("/archived");
  });

  it("derives list query from view", () => {
    expect(appViewToQuery("applications")).toEqual({ viewMode: "active", bookmarksOnly: false });
    expect(appViewToQuery("bookmarks")).toEqual({ viewMode: "active", bookmarksOnly: true });
    expect(appViewToQuery("archived")).toEqual({ viewMode: "archived", bookmarksOnly: false });
  });

  it("computes nav counts", () => {
    const counts = computeNavCounts([
      makeJobApplication({ id: "1", archived: false, pinned: true }),
      makeJobApplication({ id: "2", archived: false, pinned: false }),
      makeJobApplication({ id: "3", archived: true, pinned: true }),
    ]);

    expect(counts).toEqual({ applications: 2, bookmarked: 1, archived: 1 });
  });
});
