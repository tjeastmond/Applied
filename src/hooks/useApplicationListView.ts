"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { appViewToQuery, type AppView } from "@/lib/appView";
import {
  nextViewMode,
  persistApplicationViewMode,
  persistIncludeArchived,
  readStoredApplicationViewMode,
  readStoredIncludeArchived,
  statusFiltersForViewMode,
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

let hasRestoredApplicationPageSizePreference = false;
let hasRestoredApplicationViewModePreference = false;
let hasRestoredIncludeArchivedPreference = false;

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
    () => initialPageSizeFromPreference || hasRestoredApplicationPageSizePreference,
  );

  const listQuery = useMemo<ApplicationListViewQuery>(
    () => ({
      viewMode,
      includeArchived,
      bookmarksOnly,
      selectedCompanies,
      selectedStatuses,
      searchQuery,
    }),
    [viewMode, includeArchived, bookmarksOnly, selectedCompanies, selectedStatuses, searchQuery],
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
    if (hasRestoredApplicationPageSizePreference) {
      setHasSyncedPageSize(true);
      return;
    }

    if (initialPageSizeFromPreference) {
      hasRestoredApplicationPageSizePreference = true;
      setHasSyncedPageSize(true);
      return;
    }

    const storedPageSize = readStoredApplicationPageSize();
    setPageSize(storedPageSize);
    persistApplicationPageSize(storedPageSize);
    hasRestoredApplicationPageSizePreference = true;
    setHasSyncedPageSize(true);
  }, [initialPageSizeFromPreference]);

  useLayoutEffect(() => {
    if (routeAppView) {
      const query = appViewToQuery(routeAppView);
      setViewMode(query.viewMode);
      setBookmarksOnly(query.bookmarksOnly);
      setSelectedStatuses(statusFiltersForViewMode(query.viewMode));
      setCurrentPage(1);
      return;
    }

    if (hasRestoredApplicationViewModePreference) {
      return;
    }

    const storedViewMode = readStoredApplicationViewMode();
    if (storedViewMode === "archived") {
      setViewMode("archived");
      setSelectedStatuses(statusFiltersForViewMode("archived"));
    }

    hasRestoredApplicationViewModePreference = true;
  }, [routeAppView]);

  useLayoutEffect(() => {
    if (hasRestoredIncludeArchivedPreference) {
      return;
    }

    setIncludeArchived(readStoredIncludeArchived());
    hasRestoredIncludeArchivedPreference = true;
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
    setIncludeArchived(false);
    persistIncludeArchived(false);
    setViewMode((current) => {
      if (current !== "archived") return current;
      persistApplicationViewMode("active");
      return "active";
    });
  }, []);

  const resetToHome = useCallback(() => {
    clearFilters();
    setCurrentPage(1);
  }, [clearFilters]);

  const handleViewModeChange = useCallback((next: ApplicationViewMode) => {
    setViewMode((current) => {
      if (current === next) return current;
      persistApplicationViewMode(next);
      setSelectedStatuses(statusFiltersForViewMode(next));
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
    setSelectedCompanies(new Set([trimmed]));
    setSelectedStatuses(new Set());
    setIncludeArchived(true);
    persistIncludeArchived(true);
    setViewMode((current) => {
      if (current !== "archived") return current;
      persistApplicationViewMode("active");
      return "active";
    });
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
