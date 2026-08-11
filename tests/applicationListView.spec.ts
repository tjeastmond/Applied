import { describe, expect, it } from "vitest";
import { APPLICATION_VIEW_ALL_PAGE_SIZE } from "@/lib/applicationPagination";
import {
  listViewQueriesEqual,
  pruneCompanySelection,
  resolveApplicationListView,
  shouldClearKeyboardHighlight,
  type ApplicationListViewQuery,
} from "@/lib/applicationListView";
import { makeJobApplication } from "./fixtures/jobApplication";

function makeQuery(overrides: Partial<ApplicationListViewQuery> = {}): ApplicationListViewQuery {
  return {
    viewMode: "active",
    includeArchived: false,
    bookmarksOnly: false,
    selectedCompanies: new Set(),
    selectedStatuses: new Set(),
    searchQuery: "",
    ...overrides,
  };
}

describe("resolveApplicationListView", () => {
  const applications = [
    makeJobApplication({ id: "active-a", company: "Acme", status: "applied", archived: false, pinned: true }),
    makeJobApplication({ id: "active-b", company: "Beta", status: "rejected", archived: false }),
    makeJobApplication({ id: "archived-a", company: "Acme", status: "passed", archived: true }),
    makeJobApplication({ id: "archived-b", company: "Gamma", status: "rejected", archived: true }),
  ];

  it("partitions, filters, and paginates in one snapshot", () => {
    const snapshot = resolveApplicationListView(applications, {
      ...makeQuery({
        selectedCompanies: new Set(["Acme"]),
        searchQuery: "",
      }),
      currentPage: 1,
      pageSize: 10,
    });

    expect(snapshot.viewApplications.map((item) => item.id)).toEqual(["active-a", "active-b"]);
    expect(snapshot.companyNames).toEqual(["Acme", "Beta"]);
    expect(snapshot.filteredApplications.map((item) => item.id)).toEqual(["active-a"]);
    expect(snapshot.visibleApplications.map((item) => item.id)).toEqual(["active-a"]);
    expect(snapshot.visibleApplicationIds).toEqual(["active-a"]);
    expect(snapshot.pagination.totalCount).toBe(1);
    expect(snapshot.hasActiveFilters).toBe(true);
    expect(snapshot.isArchivedViewEmpty).toBe(false);
    expect(snapshot.isFilteredEmpty).toBe(false);
  });

  it("includes archived applications when includeArchived is enabled", () => {
    const snapshot = resolveApplicationListView(applications, {
      ...makeQuery({ includeArchived: true }),
      currentPage: 1,
      pageSize: 10,
    });

    expect(snapshot.viewApplications.map((item) => item.id)).toEqual([
      "active-a",
      "active-b",
      "archived-a",
      "archived-b",
    ]);
  });

  it("returns archived-only view applications and empty-state flags", () => {
    const snapshot = resolveApplicationListView(applications, {
      ...makeQuery({ viewMode: "archived" }),
      currentPage: 1,
      pageSize: 10,
    });

    expect(snapshot.viewApplications.map((item) => item.id)).toEqual(["archived-a", "archived-b"]);
    expect(snapshot.isArchivedViewEmpty).toBe(false);
    expect(snapshot.isFilteredEmpty).toBe(false);
  });

  it("marks archived view empty without treating it as a filter miss", () => {
    const snapshot = resolveApplicationListView([makeJobApplication({ id: "active-only", archived: false })], {
      ...makeQuery({ viewMode: "archived" }),
      currentPage: 1,
      pageSize: 10,
    });

    expect(snapshot.viewApplications).toEqual([]);
    expect(snapshot.isArchivedViewEmpty).toBe(true);
    expect(snapshot.isFilteredEmpty).toBe(false);
  });

  it("filters to pinned applications when bookmarksOnly is true", () => {
    const snapshot = resolveApplicationListView(applications, {
      ...makeQuery({ bookmarksOnly: true }),
      currentPage: 1,
      pageSize: 10,
    });

    expect(snapshot.viewApplications.map((item) => item.id)).toEqual(["active-a"]);
    expect(snapshot.isBookmarksViewEmpty).toBe(false);
  });

  it("marks bookmarks view empty when no pinned applications exist", () => {
    const snapshot = resolveApplicationListView(
      [makeJobApplication({ id: "active-only", archived: false, pinned: false })],
      {
        ...makeQuery({ bookmarksOnly: true }),
        currentPage: 1,
        pageSize: 10,
      },
    );

    expect(snapshot.viewApplications).toEqual([]);
    expect(snapshot.isBookmarksViewEmpty).toBe(true);
    expect(snapshot.isFilteredEmpty).toBe(false);
  });

  it("marks filtered empty when view has rows but filters exclude all", () => {
    const snapshot = resolveApplicationListView(applications, {
      ...makeQuery({ selectedCompanies: new Set(["Missing Co"]) }),
      currentPage: 1,
      pageSize: 10,
    });

    expect(snapshot.viewApplications.length).toBeGreaterThan(0);
    expect(snapshot.filteredApplications).toEqual([]);
    expect(snapshot.isFilteredEmpty).toBe(true);
  });

  it("clamps page when the current page exceeds filtered results", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      makeJobApplication({ id: `item-${index + 1}`, company: "Acme", archived: false }),
    );

    const snapshot = resolveApplicationListView(many, {
      ...makeQuery(),
      currentPage: 99,
      pageSize: 6,
    });

    expect(snapshot.pagination.page).toBe(2);
    expect(snapshot.visibleApplications.map((item) => item.id)).toEqual([
      "item-7",
      "item-8",
      "item-9",
      "item-10",
      "item-11",
      "item-12",
    ]);
  });

  it("paginates view-all as a single page", () => {
    const snapshot = resolveApplicationListView(applications, {
      ...makeQuery({ includeArchived: true }),
      currentPage: 2,
      pageSize: APPLICATION_VIEW_ALL_PAGE_SIZE,
    });

    expect(snapshot.pagination.page).toBe(1);
    expect(snapshot.pagination.totalPages).toBe(1);
    expect(snapshot.visibleApplications).toHaveLength(4);
  });

  it("detects active filters from archived view and include archived toggle", () => {
    expect(
      resolveApplicationListView(applications, {
        ...makeQuery({ viewMode: "archived" }),
        currentPage: 1,
        pageSize: 10,
      }).hasActiveFilters,
    ).toBe(true);

    expect(
      resolveApplicationListView(applications, {
        ...makeQuery({ viewMode: "archived", dedicatedArchivedView: true }),
        currentPage: 1,
        pageSize: 10,
      }).hasActiveFilters,
    ).toBe(false);

    expect(
      resolveApplicationListView(applications, {
        ...makeQuery({ includeArchived: true }),
        currentPage: 1,
        pageSize: 10,
      }).hasActiveFilters,
    ).toBe(true);
  });

  it("shows archived applications on dedicated archived route even when view mode desyncs", () => {
    const applications = [
      makeJobApplication({ id: "active-a", archived: false }),
      makeJobApplication({ id: "archived-a", archived: true }),
    ];

    const snapshot = resolveApplicationListView(applications, {
      ...makeQuery({ viewMode: "active", dedicatedArchivedView: true }),
      currentPage: 1,
      pageSize: 10,
    });

    expect(snapshot.viewApplications.map((item) => item.id)).toEqual(["archived-a"]);
  });
});

describe("listViewQueriesEqual", () => {
  it("compares view, include archived, search, and set selections", () => {
    const base = makeQuery();
    expect(listViewQueriesEqual(base, makeQuery())).toBe(true);
    expect(listViewQueriesEqual(base, makeQuery({ viewMode: "archived" }))).toBe(false);
    expect(listViewQueriesEqual(base, makeQuery({ includeArchived: true }))).toBe(false);
    expect(listViewQueriesEqual(base, makeQuery({ searchQuery: "engineer" }))).toBe(false);
    expect(listViewQueriesEqual(base, makeQuery({ selectedCompanies: new Set(["Acme"]) }))).toBe(false);
    expect(listViewQueriesEqual(base, makeQuery({ selectedStatuses: new Set(["applied"]) }))).toBe(false);
    expect(listViewQueriesEqual(base, makeQuery({ bookmarksOnly: true }))).toBe(false);
    expect(listViewQueriesEqual(base, makeQuery({ dedicatedArchivedView: true }))).toBe(false);
  });
});

describe("pruneCompanySelection", () => {
  it("returns null when pruning would not change the selection", () => {
    expect(pruneCompanySelection(new Set(), ["Acme"])).toBeNull();
    expect(pruneCompanySelection(new Set(["Acme"]), ["Acme", "Beta"])).toBeNull();
  });

  it("drops companies that are no longer available in the view", () => {
    expect(pruneCompanySelection(new Set(["Acme", "Removed"]), ["Acme"])).toEqual(new Set(["Acme"]));
  });
});

describe("keyboard highlight visibility", () => {
  it("clears highlight when the card is not on the current page", () => {
    const visibleIds = ["a", "b"];

    expect(shouldClearKeyboardHighlight(null, visibleIds)).toBe(false);
    expect(shouldClearKeyboardHighlight("a", visibleIds)).toBe(false);
    expect(shouldClearKeyboardHighlight("missing", visibleIds)).toBe(true);

    const pageTwoIds = ["f", "g"];
    expect(shouldClearKeyboardHighlight("a", pageTwoIds)).toBe(true);
  });
});

describe("composed pipeline golden cases", () => {
  it("shows all archived applications regardless of status", () => {
    const applications = [
      makeJobApplication({ id: "open", status: "applied", archived: false }),
      makeJobApplication({ id: "passed", status: "passed", archived: true }),
      makeJobApplication({ id: "rejected", status: "rejected", archived: true }),
      makeJobApplication({ id: "offer", status: "offer", archived: true }),
    ];

    const snapshot = resolveApplicationListView(applications, {
      ...makeQuery({
        viewMode: "archived",
      }),
      currentPage: 1,
      pageSize: 10,
    });

    expect(snapshot.filteredApplications.map((item) => item.id)).toEqual(["passed", "rejected", "offer"]);
  });

  it("resets highlight validity when search narrows visible cards", () => {
    const applications = [
      makeJobApplication({ id: "engineer", title: "Backend Engineer", archived: false }),
      makeJobApplication({ id: "designer", title: "Product Designer", archived: false }),
    ];

    const broad = resolveApplicationListView(applications, {
      ...makeQuery(),
      currentPage: 1,
      pageSize: 10,
    });
    const narrow = resolveApplicationListView(applications, {
      ...makeQuery({ searchQuery: "designer" }),
      currentPage: 1,
      pageSize: 10,
    });

    expect(shouldClearKeyboardHighlight("engineer", broad.visibleApplicationIds)).toBe(false);
    expect(shouldClearKeyboardHighlight("engineer", narrow.visibleApplicationIds)).toBe(true);
    expect(narrow.visibleApplicationIds).toEqual(["designer"]);
  });
});
