"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { appViewToQuery, isListRoutePath, type AppView } from "@/lib/appView";
import {
  consumeHistoryNavigation,
  currentHistoryEntryKey,
  installHistoryNavigationListener,
  listRouteSnapshotKey,
  readListRouteSnapshot,
  saveListRouteSnapshot,
} from "@/lib/listRouteSnapshots";
import {
  nextViewMode,
  persistApplicationViewMode,
  persistIncludeArchived,
  readStoredApplicationViewMode,
  readStoredIncludeArchived,
  type ApplicationViewMode,
} from "@/lib/applicationArchive";
import {
  clearPendingCompanyFilter,
  listViewQueriesEqual,
  peekPendingCompanyFilter,
  pruneCompanySelection,
  queuePendingCompanyFilter,
  resolveApplicationListView,
  resolvePendingCompanyOnRouteChange,
  type ApplicationListViewQuery,
} from "@/lib/applicationListView";
import {
  persistApplicationPageSize,
  readStoredApplicationPageSize,
  type ApplicationPageSize,
} from "@/lib/applicationPagination";
import type { ApplicationStatus, JobApplication } from "@/types";

const sessionListPrefs = {
  pageSizeRestored: false,
  viewModeRestored: false,
  includeArchivedRestored: false,
};

function companyFilterSelection(company: string) {
  return {
    selectedCompanies: new Set([company]),
    selectedStatuses: new Set<ApplicationStatus>(),
  };
}

function exitArchivedViewIfNeeded(current: ApplicationViewMode): ApplicationViewMode {
  if (current !== "archived") return current;
  persistApplicationViewMode("active");
  return "active";
}

function includeArchivedForRoute(routeAppView: AppView, pendingCompany: string | null): boolean {
  if (pendingCompany !== null && routeAppView === "applications") {
    return true;
  }

  switch (routeAppView) {
    case "archived":
    case "bookmarks":
    case "toApply":
      return false;
    case "applications":
      return readStoredIncludeArchived();
    default: {
      const exhaustive: never = routeAppView;
      return exhaustive;
    }
  }
}

type UseApplicationListViewOptions = {
  applications: JobApplication[];
  initialPageSize: ApplicationPageSize;
  initialPageSizeFromPreference: boolean;
  routeAppView?: AppView;
  /** Id of the application whose drawer should be remembered when leaving a list route. */
  getOpenApplicationId?: () => string | null;
  /** Called when Back/Forward restores a snapshot that had a drawer open. */
  onRestoreOpenApplication?: (id: string) => void;
};

export function useApplicationListView({
  applications,
  initialPageSize,
  initialPageSizeFromPreference,
  routeAppView,
  getOpenApplicationId,
  onRestoreOpenApplication,
}: UseApplicationListViewOptions) {
  const pathname = usePathname();
  const routeQuery = routeAppView ? appViewToQuery(routeAppView) : null;
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(() => {
    if (routeAppView !== "applications") return new Set();
    const pending = peekPendingCompanyFilter();
    return pending ? companyFilterSelection(pending).selectedCompanies : new Set();
  });
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ApplicationStatus>>(() => new Set());
  const [viewMode, setViewMode] = useState<ApplicationViewMode>(() => routeQuery?.viewMode ?? "active");
  const [bookmarksOnly, setBookmarksOnly] = useState(() => routeQuery?.bookmarksOnly ?? false);
  const [toApplyOnly, setToApplyOnly] = useState(() => routeQuery?.toApplyOnly ?? false);
  const [includeArchived, setIncludeArchived] = useState(
    () => routeAppView === "applications" && peekPendingCompanyFilter() !== null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<ApplicationPageSize>(initialPageSize);
  const [hasSyncedPageSize, setHasSyncedPageSize] = useState(
    () => initialPageSizeFromPreference || sessionListPrefs.pageSizeRestored,
  );

  const dedicatedArchivedView = routeAppView === "archived";

  const listQuery = useMemo<ApplicationListViewQuery>(
    () => ({
      viewMode,
      includeArchived,
      bookmarksOnly,
      toApplyOnly,
      selectedCompanies,
      selectedStatuses,
      searchQuery,
      dedicatedArchivedView,
    }),
    [
      viewMode,
      includeArchived,
      bookmarksOnly,
      toApplyOnly,
      selectedCompanies,
      selectedStatuses,
      searchQuery,
      dedicatedArchivedView,
    ],
  );

  const previousListQueryRef = useRef(listQuery);
  const lastPathnameRef = useRef<string | null | undefined>(undefined);
  const lastHistoryEntryKeyRef = useRef<string | null>(null);
  const latestStateRef = useRef({
    selectedCompanies,
    selectedStatuses,
    searchQuery,
    includeArchived,
    viewMode,
    currentPage,
  });
  latestStateRef.current = { selectedCompanies, selectedStatuses, searchQuery, includeArchived, viewMode, currentPage };
  const getOpenApplicationIdRef = useRef(getOpenApplicationId);
  getOpenApplicationIdRef.current = getOpenApplicationId;
  const onRestoreOpenApplicationRef = useRef(onRestoreOpenApplication);
  onRestoreOpenApplicationRef.current = onRestoreOpenApplication;

  useEffect(() => {
    installHistoryNavigationListener();
  }, []);

  const snapshot = useMemo(
    () =>
      resolveApplicationListView(applications, {
        ...listQuery,
        currentPage,
        pageSize,
      }),
    [applications, listQuery, currentPage, pageSize],
  );

  useLayoutEffect(() => {
    if (sessionListPrefs.pageSizeRestored) {
      setHasSyncedPageSize(true);
      return;
    }

    if (initialPageSizeFromPreference) {
      sessionListPrefs.pageSizeRestored = true;
      setHasSyncedPageSize(true);
      return;
    }

    const storedPageSize = readStoredApplicationPageSize();
    setPageSize(storedPageSize);
    persistApplicationPageSize(storedPageSize);
    sessionListPrefs.pageSizeRestored = true;
    setHasSyncedPageSize(true);
  }, [initialPageSizeFromPreference]);

  useLayoutEffect(() => {
    const previousPathname = lastPathnameRef.current;
    lastPathnameRef.current = pathname;
    const previousEntryKey = lastHistoryEntryKeyRef.current;
    const entryKey = currentHistoryEntryKey();
    lastHistoryEntryKeyRef.current = entryKey;

    if (routeAppView && pathname != null && previousPathname != null && previousPathname !== pathname) {
      const wasHistoryNavigation = consumeHistoryNavigation();

      if (isListRoutePath(previousPathname)) {
        const latest = latestStateRef.current;
        saveListRouteSnapshot(listRouteSnapshotKey(previousPathname, previousEntryKey), {
          selectedCompanies: [...latest.selectedCompanies],
          selectedStatuses: [...latest.selectedStatuses],
          searchQuery: latest.searchQuery,
          includeArchived: latest.includeArchived,
          viewMode: latest.viewMode,
          currentPage: latest.currentPage,
          openApplicationId: getOpenApplicationIdRef.current?.() ?? null,
        });
      }

      // Non-list routes (companies, profile) do not use list state; leave it untouched.
      if (!isListRoutePath(pathname)) return;

      // With an entry key, a snapshot exists only for entries we already visited (Back/Forward);
      // without one, fall back to the popstate flag.
      const saved =
        entryKey !== null
          ? readListRouteSnapshot(listRouteSnapshotKey(pathname, entryKey))
          : wasHistoryNavigation
            ? readListRouteSnapshot(pathname)
            : null;
      if (saved && peekPendingCompanyFilter() === null) {
        const query = appViewToQuery(routeAppView);
        const restored = {
          viewMode: saved.viewMode,
          includeArchived: saved.includeArchived,
          bookmarksOnly: query.bookmarksOnly,
          toApplyOnly: query.toApplyOnly,
          selectedCompanies: new Set(saved.selectedCompanies),
          selectedStatuses: new Set(saved.selectedStatuses),
          searchQuery: saved.searchQuery,
          dedicatedArchivedView: routeAppView === "archived",
        };
        // Pre-seed so the "query changed -> page 1" effect does not clobber the restored page.
        previousListQueryRef.current = restored;
        setViewMode(restored.viewMode);
        setBookmarksOnly(restored.bookmarksOnly);
        setToApplyOnly(restored.toApplyOnly);
        setSearchQuery(restored.searchQuery);
        setSelectedCompanies(restored.selectedCompanies);
        setSelectedStatuses(restored.selectedStatuses);
        setIncludeArchived(restored.includeArchived);
        setCurrentPage(saved.currentPage);
        persistApplicationViewMode(restored.viewMode);
        sessionListPrefs.includeArchivedRestored = true;
        if (saved.openApplicationId) {
          onRestoreOpenApplicationRef.current?.(saved.openApplicationId);
        }
        return;
      }
    }

    if (routeAppView) {
      const query = appViewToQuery(routeAppView);
      const { applyCompany, retainPending } = resolvePendingCompanyOnRouteChange(
        routeAppView,
        peekPendingCompanyFilter(),
      );
      if (!retainPending) {
        clearPendingCompanyFilter();
      }

      const filter = applyCompany ? companyFilterSelection(applyCompany) : null;

      setViewMode(query.viewMode);
      setBookmarksOnly(query.bookmarksOnly);
      setToApplyOnly(query.toApplyOnly);
      setSearchQuery("");
      setSelectedCompanies(filter?.selectedCompanies ?? new Set());
      setSelectedStatuses(filter?.selectedStatuses ?? new Set());
      setIncludeArchived(includeArchivedForRoute(routeAppView, applyCompany));
      if (filter) {
        persistIncludeArchived(true);
      }
      setCurrentPage(1);
      persistApplicationViewMode(query.viewMode);
      sessionListPrefs.includeArchivedRestored = true;
      return;
    }

    if (sessionListPrefs.viewModeRestored) {
      return;
    }

    const storedViewMode = readStoredApplicationViewMode();
    if (storedViewMode === "archived") {
      setViewMode("archived");
    }

    sessionListPrefs.viewModeRestored = true;
  }, [routeAppView, pathname]);

  useLayoutEffect(() => {
    if (sessionListPrefs.includeArchivedRestored) {
      return;
    }

    setIncludeArchived(readStoredIncludeArchived());
    sessionListPrefs.includeArchivedRestored = true;
  }, []);

  useEffect(() => {
    const previousQuery = previousListQueryRef.current;
    if (!listViewQueriesEqual(previousQuery, listQuery)) {
      setCurrentPage(1);
    }
    previousListQueryRef.current = listQuery;
  }, [listQuery]);

  useEffect(() => {
    if (snapshot.pagination.page !== currentPage) {
      setCurrentPage(snapshot.pagination.page);
    }
  }, [currentPage, snapshot.pagination.page]);

  useEffect(() => {
    const pruned = pruneCompanySelection(selectedCompanies, snapshot.companyNames);
    if (pruned !== null) {
      setSelectedCompanies(pruned);
    }
  }, [selectedCompanies, snapshot.companyNames]);

  const clearFilters = useCallback(() => {
    clearPendingCompanyFilter();
    setSelectedCompanies(new Set());
    setSelectedStatuses(new Set());
    setSearchQuery("");
    if (routeAppView === "archived") {
      return;
    }
    setIncludeArchived(false);
    persistIncludeArchived(false);
    setViewMode((current) => {
      if (current !== "archived") return current;
      persistApplicationViewMode("active");
      return "active";
    });
  }, [routeAppView]);

  const resetToHome = useCallback(() => {
    clearFilters();
    setCurrentPage(1);
  }, [clearFilters]);

  const handleViewModeChange = useCallback((next: ApplicationViewMode) => {
    setViewMode((current) => {
      if (current === next) return current;
      persistApplicationViewMode(next);
      setSelectedStatuses(new Set());
      setCurrentPage(1);
      return next;
    });
  }, []);

  const handleViewModeToggle = useCallback(() => {
    handleViewModeChange(nextViewMode(viewMode));
  }, [handleViewModeChange, viewMode]);

  const handleIncludeArchivedChange = useCallback((next: boolean) => {
    setIncludeArchived(next);
    persistIncludeArchived(next);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((nextPageSize: ApplicationPageSize) => {
    setPageSize(nextPageSize);
    persistApplicationPageSize(nextPageSize);
    setCurrentPage(1);
  }, []);

  const queuePendingCompanyFilterForNavigation = useCallback((company: string) => {
    queuePendingCompanyFilter(company);
  }, []);

  const handleCompanyFilter = useCallback((company: string) => {
    const trimmed = company.trim();
    if (!trimmed) return;
    const filter = companyFilterSelection(trimmed);
    setSelectedCompanies(filter.selectedCompanies);
    setSelectedStatuses(filter.selectedStatuses);
    setIncludeArchived(true);
    persistIncludeArchived(true);
    setViewMode(exitArchivedViewIfNeeded);
    setToApplyOnly(false);
    setBookmarksOnly(false);
  }, []);

  const resetListPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    snapshot,
    viewMode,
    bookmarksOnly,
    toApplyOnly,
    includeArchived,
    selectedCompanies,
    selectedStatuses,
    searchQuery,
    currentPage,
    pageSize,
    hasSyncedPageSize,
    setSelectedCompanies,
    setSelectedStatuses,
    setSearchQuery,
    clearFilters,
    resetToHome,
    handleViewModeChange,
    handleViewModeToggle,
    handleIncludeArchivedChange,
    handlePageChange,
    handlePageSizeChange,
    handleCompanyFilter,
    queuePendingCompanyFilterForNavigation,
    resetListPagination,
  };
}
