import type { ApplicationViewMode } from "@/lib/applicationArchive";
import { APPLICATION_STATUSES } from "@/lib/applicationStatus";
import type { ApplicationStatus } from "@/types";

export const LIST_ROUTE_SNAPSHOTS_STORAGE_KEY = "applied-dev-list-snapshots";

export type ListRouteSnapshot = {
  selectedCompanies: string[];
  selectedStatuses: ApplicationStatus[];
  searchQuery: string;
  includeArchived: boolean;
  viewMode: ApplicationViewMode;
  currentPage: number;
  openApplicationId: string | null;
};

/** Keep sessionStorage small; oldest history entries are dropped first. */
const MAX_SNAPSHOTS = 50;

const memorySnapshots = new Map<string, ListRouteSnapshot>();
let storageLoaded = false;

function isStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

/** Returns a validated snapshot, or null when the value is malformed. */
export function deserializeListRouteSnapshot(value: unknown): ListRouteSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (!Array.isArray(raw.selectedCompanies) || !raw.selectedCompanies.every((c) => typeof c === "string")) {
    return null;
  }
  if (!Array.isArray(raw.selectedStatuses) || !raw.selectedStatuses.every(isStatus)) return null;
  if (typeof raw.searchQuery !== "string") return null;
  if (typeof raw.includeArchived !== "boolean") return null;
  if (raw.viewMode !== "active" && raw.viewMode !== "archived") return null;
  if (typeof raw.currentPage !== "number" || !Number.isInteger(raw.currentPage) || raw.currentPage < 1) {
    return null;
  }
  if (raw.openApplicationId !== null && typeof raw.openApplicationId !== "string") return null;

  return {
    selectedCompanies: [...raw.selectedCompanies],
    selectedStatuses: [...raw.selectedStatuses],
    searchQuery: raw.searchQuery,
    includeArchived: raw.includeArchived,
    viewMode: raw.viewMode,
    currentPage: raw.currentPage,
    openApplicationId: raw.openApplicationId,
  };
}

export function serializeListRouteSnapshots(snapshots: ReadonlyMap<string, ListRouteSnapshot>): string {
  return JSON.stringify(Object.fromEntries(snapshots));
}

/** Parses stored JSON into a map, dropping malformed entries; returns an empty map for bad input. */
export function deserializeListRouteSnapshots(raw: string | null): Map<string, ListRouteSnapshot> {
  const result = new Map<string, ListRouteSnapshot>();
  if (!raw) return result;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return result;
    for (const [pathname, value] of Object.entries(parsed)) {
      const snapshot = deserializeListRouteSnapshot(value);
      if (snapshot) result.set(pathname, snapshot);
    }
  } catch {
    // ignore malformed JSON
  }
  return result;
}

function loadFromStorage(): void {
  if (storageLoaded) return;
  storageLoaded = true;
  try {
    if (typeof window === "undefined") return;
    const stored = deserializeListRouteSnapshots(window.sessionStorage.getItem(LIST_ROUTE_SNAPSHOTS_STORAGE_KEY));
    for (const [pathname, snapshot] of stored) {
      if (!memorySnapshots.has(pathname)) memorySnapshots.set(pathname, snapshot);
    }
  } catch {
    // storage unavailable
  }
}

function persistToStorage(): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(LIST_ROUTE_SNAPSHOTS_STORAGE_KEY, serializeListRouteSnapshots(memorySnapshots));
  } catch {
    // storage unavailable; memory copy still works
  }
}

export function saveListRouteSnapshot(pathname: string, snapshot: ListRouteSnapshot): void {
  loadFromStorage();
  memorySnapshots.delete(pathname);
  memorySnapshots.set(pathname, snapshot);
  while (memorySnapshots.size > MAX_SNAPSHOTS) {
    const oldest = memorySnapshots.keys().next().value;
    if (oldest === undefined) break;
    memorySnapshots.delete(oldest);
  }
  persistToStorage();
}

export function readListRouteSnapshot(pathname: string): ListRouteSnapshot | null {
  loadFromStorage();
  return memorySnapshots.get(pathname) ?? null;
}

/** Test helper: clears memory and forces a reload from storage on next access. */
export function resetListRouteSnapshotsForTests(options: { clearStorage?: boolean } = {}): void {
  memorySnapshots.clear();
  storageLoaded = false;
  historyNavigationPending = false;
  if (options.clearStorage) {
    try {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(LIST_ROUTE_SNAPSHOTS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

let historyNavigationPending = false;
let historyListenerInstalled = false;

function onPopState() {
  historyNavigationPending = true;
}

/**
 * Idempotent. Fallback signal for browsers without the Navigation API; popstate can fire after
 * the router has already re-rendered, so prefer `currentHistoryEntryKey()` when available.
 */
export function installHistoryNavigationListener(): void {
  if (historyListenerInstalled || typeof window === "undefined") return;
  historyListenerInstalled = true;
  window.addEventListener("popstate", onPopState, { capture: true });
}

/** Returns whether a Back/Forward navigation happened since the last call, and clears the flag. */
export function consumeHistoryNavigation(): boolean {
  const pending = historyNavigationPending;
  historyNavigationPending = false;
  return pending;
}

type NavigationLike = { currentEntry?: { key?: unknown } | null };

/**
 * Stable key for the current session-history entry (Navigation API). Back/Forward returns to an
 * entry with the same key, while push navigations create a new one, so snapshots keyed by it are
 * restored only on history traversal regardless of event ordering. Null when unsupported.
 */
export function currentHistoryEntryKey(): string | null {
  if (typeof window === "undefined") return null;
  const navigation = (window as unknown as { navigation?: NavigationLike }).navigation;
  const key = navigation?.currentEntry?.key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/** Storage key for a list route snapshot: per history entry when possible, else per pathname. */
export function listRouteSnapshotKey(pathname: string, entryKey: string | null): string {
  return entryKey ? `${entryKey}:${pathname}` : pathname;
}
