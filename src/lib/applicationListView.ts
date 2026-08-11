import type { ApplicationViewMode } from "@/lib/applicationArchive";
import { partitionApplicationsByView } from "@/lib/applicationArchive";
import { filterApplications, hasActiveApplicationFilters } from "@/lib/applicationFilters";
import { uniqueCompanyNames } from "@/lib/companyFilter";
import { paginateItems, type ApplicationPageSize, type PaginatedSlice } from "@/lib/applicationPagination";
import type { ApplicationStatus, JobApplication } from "@/types";

export type ApplicationListViewQuery = {
  viewMode: ApplicationViewMode;
  includeArchived: boolean;
  bookmarksOnly: boolean;
  selectedCompanies: ReadonlySet<string>;
  selectedStatuses: ReadonlySet<ApplicationStatus>;
  searchQuery: string;
  /** When true, list is the dedicated /archived route (always shows archived rows). */
  dedicatedArchivedView?: boolean;
};

export type ApplicationListViewParams = ApplicationListViewQuery & {
  currentPage: number;
  pageSize: ApplicationPageSize;
};

export type ApplicationListViewSnapshot = {
  viewApplications: JobApplication[];
  companyNames: string[];
  filteredApplications: JobApplication[];
  pagination: PaginatedSlice<JobApplication>;
  visibleApplications: JobApplication[];
  visibleApplicationIds: readonly string[];
  hasActiveFilters: boolean;
  isArchivedViewEmpty: boolean;
  isBookmarksViewEmpty: boolean;
  isFilteredEmpty: boolean;
};

function setsEqual<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

export function listViewQueriesEqual(left: ApplicationListViewQuery, right: ApplicationListViewQuery): boolean {
  return (
    left.viewMode === right.viewMode &&
    left.includeArchived === right.includeArchived &&
    left.bookmarksOnly === right.bookmarksOnly &&
    left.dedicatedArchivedView === right.dedicatedArchivedView &&
    left.searchQuery === right.searchQuery &&
    setsEqual(left.selectedCompanies, right.selectedCompanies) &&
    setsEqual(left.selectedStatuses, right.selectedStatuses)
  );
}

export function resolveApplicationListView(
  applications: readonly JobApplication[],
  params: ApplicationListViewParams,
): ApplicationListViewSnapshot {
  const {
    viewMode,
    includeArchived,
    bookmarksOnly,
    selectedCompanies,
    selectedStatuses,
    searchQuery,
    currentPage,
    pageSize,
    dedicatedArchivedView = false,
  } = params;

  const effectiveViewMode = dedicatedArchivedView ? "archived" : viewMode;
  const effectiveIncludeArchived = dedicatedArchivedView ? false : includeArchived;

  let viewApplications = partitionApplicationsByView(applications, effectiveViewMode, effectiveIncludeArchived);
  if (bookmarksOnly) {
    viewApplications = viewApplications.filter((application) => application.pinned);
  }
  const companyNames = uniqueCompanyNames(viewApplications);
  const filteredApplications = filterApplications(viewApplications, {
    selectedCompanies,
    selectedStatuses,
    searchQuery,
  });
  const pagination = paginateItems(filteredApplications, currentPage, pageSize);
  const visibleApplications = pagination.items;
  const visibleApplicationIds = visibleApplications.map((application) => application.id);

  return {
    viewApplications,
    companyNames,
    filteredApplications,
    pagination,
    visibleApplications,
    visibleApplicationIds,
    hasActiveFilters: hasActiveApplicationFilters({
      selectedCompanies,
      selectedStatuses,
      searchQuery,
      viewMode: effectiveViewMode,
      includeArchived: effectiveIncludeArchived,
      dedicatedArchivedView,
    }),
    isArchivedViewEmpty: effectiveViewMode === "archived" && viewApplications.length === 0,
    isBookmarksViewEmpty: bookmarksOnly && viewApplications.length === 0,
    isFilteredEmpty:
      filteredApplications.length === 0 &&
      !(effectiveViewMode === "archived" && viewApplications.length === 0) &&
      !(bookmarksOnly && viewApplications.length === 0),
  };
}

export function pruneCompanySelection(
  selectedCompanies: ReadonlySet<string>,
  companyNames: readonly string[],
): Set<string> | null {
  if (selectedCompanies.size === 0) return null;

  const available = new Set(companyNames);
  const next = new Set([...selectedCompanies].filter((name) => available.has(name)));
  return next.size === selectedCompanies.size ? null : next;
}

export function shouldClearKeyboardHighlight(
  highlightId: string | null,
  visibleApplicationIds: readonly string[],
): boolean {
  return highlightId !== null && !visibleApplicationIds.includes(highlightId);
}
