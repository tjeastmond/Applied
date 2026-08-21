import { describe, expect, it } from "vitest";
import {
  appViewToPath,
  appViewToQuery,
  companyFilterNavigatesHome,
  computeNavCounts,
  pathToAppView,
  shouldShowIncludeArchived,
} from "@/lib/appView";
import { makeJobApplication } from "./fixtures/jobApplication";

describe("appView", () => {
  it("maps paths to views", () => {
    expect(pathToAppView("/")).toBe("applications");
    expect(pathToAppView("/to-apply")).toBe("toApply");
    expect(pathToAppView("/bookmarks")).toBe("bookmarks");
    expect(pathToAppView("/archived")).toBe("archived");
  });

  it("maps views to paths", () => {
    expect(appViewToPath("applications")).toBe("/");
    expect(appViewToPath("toApply")).toBe("/to-apply");
    expect(appViewToPath("bookmarks")).toBe("/bookmarks");
    expect(appViewToPath("archived")).toBe("/archived");
  });

  it("derives list query from view", () => {
    expect(appViewToQuery("applications")).toEqual({ viewMode: "active", bookmarksOnly: false, toApplyOnly: false });
    expect(appViewToQuery("toApply")).toEqual({ viewMode: "active", bookmarksOnly: false, toApplyOnly: true });
    expect(appViewToQuery("bookmarks")).toEqual({ viewMode: "active", bookmarksOnly: true, toApplyOnly: false });
    expect(appViewToQuery("archived")).toEqual({ viewMode: "archived", bookmarksOnly: false, toApplyOnly: false });
  });

  it("shows Include Archived only on the home applications list", () => {
    expect(
      shouldShowIncludeArchived({
        routeAppView: "applications",
        viewMode: "active",
        bookmarksOnly: false,
      }),
    ).toBe(true);
    expect(
      shouldShowIncludeArchived({
        routeAppView: "toApply",
        viewMode: "active",
        bookmarksOnly: false,
      }),
    ).toBe(false);
    expect(
      shouldShowIncludeArchived({
        routeAppView: "bookmarks",
        viewMode: "active",
        bookmarksOnly: true,
      }),
    ).toBe(false);
    expect(
      shouldShowIncludeArchived({
        routeAppView: "archived",
        viewMode: "archived",
        bookmarksOnly: false,
      }),
    ).toBe(false);
    expect(
      shouldShowIncludeArchived({
        viewMode: "active",
        bookmarksOnly: false,
      }),
    ).toBe(true);
    expect(
      shouldShowIncludeArchived({
        viewMode: "archived",
        bookmarksOnly: false,
      }),
    ).toBe(false);
    expect(
      shouldShowIncludeArchived({
        viewMode: "active",
        bookmarksOnly: true,
      }),
    ).toBe(false);
  });

  it("computes nav counts", () => {
    const counts = computeNavCounts([
      makeJobApplication({ id: "1", archived: false, pinned: true, status: "to_apply" }),
      makeJobApplication({ id: "2", archived: false, pinned: false }),
      makeJobApplication({ id: "3", archived: true, pinned: true, status: "to_apply" }),
    ]);

    expect(counts).toEqual({ applications: 2, toApply: 1, bookmarked: 1, archived: 1 });
  });

  it("leaves dedicated views when filtering by company", () => {
    expect(companyFilterNavigatesHome("applications")).toBe(false);
    expect(companyFilterNavigatesHome("toApply")).toBe(true);
    expect(companyFilterNavigatesHome("bookmarks")).toBe(true);
    expect(companyFilterNavigatesHome("archived")).toBe(true);
    expect(companyFilterNavigatesHome(undefined)).toBe(false);
  });
});
