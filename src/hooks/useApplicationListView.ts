"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { appViewToQuery, type AppView } from "@/lib/appView";
import {
  nextViewMode,
  persistApplicationViewMode,
  persistIncludeArchived,
  readStoredApplicationViewMode,
  readStoredIncludeArchived,
  type ApplicationViewMode,
} from "@/lib/applicationArchive";
import {
  listViewQueriesEqual,
  pruneCompanySelection,
  resolveApplicationListView,
  type ApplicationListViewQuery,
} from "@/lib/applicationListView";
import {
  persistApplicationPageSize,
  readStoredApplicationPageSize,
  type ApplicationPageSize,
} from "@/lib/applicationPagination";
import type { ApplicationStatus, JobApplication } from "@/types";

/** Session-scoped guards so localStorage prefs restore once per page load, not on every remount. */
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
      return false;
    case "applications":
      return readStoredIncludeArchived();
    case "bookmarks":
      return false;
  }
}

type UseApplicationListViewOptions = {
  applications: JobApplication[];
  initialPageSize: ApplicationPageSize;
  initialPageSizeFromPreference: boolean;
  /** When set, list view syncs to route-based navigation (shell mode). */
  routeAppView?: AppView;
};

export function useApplicationListView({
  applications,
  initialPageSize,
  initialPageSizeFromPreference,
  routeAppView,
}: UseApplicationListViewOptions) {
  const routeQuery = routeAppView ? appViewToQuery(routeAppView) : null;
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(() => new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ApplicationStatus>>(() => new Set());
  const [viewMode, setViewMode] = useState<ApplicationViewMode>(() => routeQuery?.viewMode ?? "active");
  const [bookmarksOnly, setBookmarksOnly] = useState(() => routeQuery?.bookmarksOnly ?? false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<ApplicationPageSize>(initialPageSize);
  const [hasSyncedPageSize, setHasSyncedPageSize] = useState(
    () => initialPageSizeFromPreference || sessionListPrefs.pageSizeRestored,
  );

  const dedicatedArchivedView = routeAppView === "archived";
  const pendingCompanyFilterRef = useRef<string | null>(null);

  const listQuery = useMemo<ApplicationListViewQuery>(
    () => ({
      viewMode,
      includeArchived,
      bookmarksOnly,
      selectedCompanies,
      selectedStatuses,
      searchQuery,
      dedicatedArchivedView,
    }),
    [viewMode, includeArchived, bookmarksOnly, selectedCompanies, selectedStatuses, searchQuery, dedicatedArchivedView],
  );

  const previousListQueryRef = useRef(listQuery);

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
    if (routeAppView) {
      const query = appViewToQuery(routeAppView);
      const pendingCompany = pendingCompanyFilterRef.current;
      pendingCompanyFilterRef.current = null;
      const filter = pendingCompany ? companyFilterSelection(pendingCompany) : null;

      setViewMode(query.viewMode);
      setBookmarksOnly(query.bookmarksOnly);
      setSearchQuery("");
      setSelectedCompanies(filter?.selectedCompanies ?? new Set());
      setSelectedStatuses(filter?.selectedStatuses ?? new Set());
      setIncludeArchived(includeArchivedForRoute(routeAppView, pendingCompany));
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
  }, [routeAppView]);

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

  const handleCompanyFilter = useCallback((company: string) => {
    const trimmed = company.trim();
    if (!trimmed) return;
    pendingCompanyFilterRef.current = trimmed;
    const filter = companyFilterSelection(trimmed);
    setSelectedCompanies(filter.selectedCompanies);
    setSelectedStatuses(filter.selectedStatuses);
    setIncludeArchived(true);
    persistIncludeArchived(true);
    setViewMode(exitArchivedViewIfNeeded);
  }, []);

  const resetListPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    snapshot,
    viewMode,
    bookmarksOnly,
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
    resetListPagination,
  };
}
