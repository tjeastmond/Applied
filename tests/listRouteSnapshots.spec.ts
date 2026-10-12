/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isListRoutePath } from "@/lib/appView";
import {
  consumeHistoryNavigation,
  currentHistoryEntryKey,
  deserializeListRouteSnapshot,
  deserializeListRouteSnapshots,
  installHistoryNavigationListener,
  LIST_ROUTE_SNAPSHOTS_STORAGE_KEY,
  listRouteSnapshotKey,
  readListRouteSnapshot,
  resetListRouteSnapshotsForTests,
  saveListRouteSnapshot,
  serializeListRouteSnapshots,
  type ListRouteSnapshot,
} from "@/lib/listRouteSnapshots";

const snapshot: ListRouteSnapshot = {
  selectedCompanies: ["Acme"],
  selectedStatuses: ["applied", "offer"],
  searchQuery: "eng",
  includeArchived: true,
  viewMode: "active",
  currentPage: 3,
  openApplicationId: "abc",
};

beforeEach(() => resetListRouteSnapshotsForTests({ clearStorage: true }));
afterEach(() => vi.restoreAllMocks());

describe("snapshot (de)serialization", () => {
  it("round-trips", () => {
    const map = new Map([["/", snapshot]]);
    const parsed = deserializeListRouteSnapshots(serializeListRouteSnapshots(map));
    expect(parsed.get("/")).toEqual(snapshot);
  });

  it("rejects malformed snapshots", () => {
    expect(deserializeListRouteSnapshot(null)).toBeNull();
    expect(deserializeListRouteSnapshot({ ...snapshot, selectedStatuses: ["bogus"] })).toBeNull();
    expect(deserializeListRouteSnapshot({ ...snapshot, viewMode: "nope" })).toBeNull();
    expect(deserializeListRouteSnapshot({ ...snapshot, currentPage: 0 })).toBeNull();
    expect(deserializeListRouteSnapshot({ ...snapshot, openApplicationId: 5 })).toBeNull();
    expect(deserializeListRouteSnapshot({ ...snapshot, selectedCompanies: [1] })).toBeNull();
  });

  it("ignores bad JSON and drops bad entries", () => {
    expect(deserializeListRouteSnapshots("{not json").size).toBe(0);
    expect(deserializeListRouteSnapshots("[]").size).toBe(0);
    expect(deserializeListRouteSnapshots(null).size).toBe(0);
    const mixed = JSON.stringify({ "/": snapshot, "/bad": { foo: 1 } });
    const parsed = deserializeListRouteSnapshots(mixed);
    expect([...parsed.keys()]).toEqual(["/"]);
  });
});

describe("save/read", () => {
  it("persists to sessionStorage and reloads", () => {
    saveListRouteSnapshot("/to-apply", snapshot);
    expect(window.sessionStorage.getItem(LIST_ROUTE_SNAPSHOTS_STORAGE_KEY)).toContain("/to-apply");
    resetListRouteSnapshotsForTests();
    expect(readListRouteSnapshot("/to-apply")).toEqual(snapshot);
    expect(readListRouteSnapshot("/")).toBeNull();
  });

  it("works when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    saveListRouteSnapshot("/", snapshot);
    expect(readListRouteSnapshot("/")).toEqual(snapshot);
  });
});

describe("history navigation flag", () => {
  it("is set by popstate and consumed once", () => {
    installHistoryNavigationListener();
    installHistoryNavigationListener();
    expect(consumeHistoryNavigation()).toBe(false);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(consumeHistoryNavigation()).toBe(true);
    expect(consumeHistoryNavigation()).toBe(false);
  });
});

describe("history entry keys", () => {
  afterEach(() => {
    delete (window as unknown as { navigation?: unknown }).navigation;
  });

  it("reads the Navigation API entry key when available", () => {
    expect(currentHistoryEntryKey()).toBeNull();
    (window as unknown as { navigation: unknown }).navigation = { currentEntry: { key: "entry-1" } };
    expect(currentHistoryEntryKey()).toBe("entry-1");
  });

  it("scopes snapshots per entry so a fresh push does not restore", () => {
    saveListRouteSnapshot(listRouteSnapshotKey("/", "entry-1"), snapshot);
    expect(readListRouteSnapshot(listRouteSnapshotKey("/", "entry-1"))).toEqual(snapshot);
    expect(readListRouteSnapshot(listRouteSnapshotKey("/", "entry-2"))).toBeNull();
    expect(listRouteSnapshotKey("/", null)).toBe("/");
  });

  it("caps stored snapshots, dropping the oldest", () => {
    for (let i = 0; i < 55; i++) saveListRouteSnapshot(`k${i}`, snapshot);
    expect(readListRouteSnapshot("k0")).toBeNull();
    expect(readListRouteSnapshot("k54")).toEqual(snapshot);
  });
});

describe("isListRoutePath", () => {
  it("matches list routes only", () => {
    for (const path of ["/", "/to-apply", "/bookmarks", "/archived"]) expect(isListRoutePath(path)).toBe(true);
    for (const path of ["/companies", "/companies/x", "/profile", "/analytics", null, undefined]) {
      expect(isListRoutePath(path)).toBe(false);
    }
  });
});
