"use client";

import { ApplicationCard } from "@/components/ApplicationCard";
import { ApplicationCardPagination } from "@/components/ApplicationCardPagination";
import { ApplicationFilters } from "@/components/ApplicationFilters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AuthenticatedAppController } from "@/hooks/useAuthenticatedAppController";
import { modKShortcutDescription, modKShortcutLabel } from "@/lib/keyboardShortcut";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shell: single column below lg (~1024px); two columns from lg when card width stays ~320–400px. */
const APPLICATION_CARD_GRID_CLASSES = "grid grid-cols-1 gap-4 lg:grid-cols-2";
const APPLICATION_CARD_GRID_SINGLE_COLUMN_CLASSES = "grid grid-cols-1 gap-4";
const EMPTY_STATE_CARD_CLASS = "shadow-sm shadow-black/5";

type ApplicationListPageProps = Pick<
  AuthenticatedAppController,
  | "applications"
  | "companyNames"
  | "visibleApplications"
  | "hasActiveFilters"
  | "paginatedApplications"
  | "isArchivedViewEmpty"
  | "isBookmarksViewEmpty"
  | "isToApplyViewEmpty"
  | "isFilteredEmpty"
  | "hasSyncedPageSize"
  | "includeArchived"
  | "showIncludeArchived"
  | "selectedCompanies"
  | "selectedStatuses"
  | "searchQuery"
  | "pageSize"
  | "detailOpen"
  | "keyboardHighlightId"
  | "applicationsListRef"
  | "searchInputRef"
  | "setSelectedCompanies"
  | "setSelectedStatuses"
  | "setSearchQuery"
  | "handleIncludeArchivedChange"
  | "clearFilters"
  | "handleViewModeToggle"
  | "openAddForm"
  | "handleOpenApplication"
  | "handlePrefetchNotes"
  | "handleStatusChange"
  | "handlePinChange"
  | "handleCompanyFilter"
  | "handlePageChange"
  | "handlePageSizeChange"
  | "handleCardMouseEnter"
  | "handleCardMouseLeave"
> & {
  onBackToApplications?: () => void;
  edgeBleedClassName?: string;
  showListFooter?: boolean;
  /** Classic UI uses a single column at all breakpoints. */
  singleColumnCards?: boolean;
};

export function ApplicationListPage({
  applications,
  companyNames,
  visibleApplications,
  hasActiveFilters,
  paginatedApplications,
  isArchivedViewEmpty,
  isBookmarksViewEmpty,
  isToApplyViewEmpty,
  isFilteredEmpty,
  hasSyncedPageSize,
  includeArchived,
  showIncludeArchived,
  selectedCompanies,
  selectedStatuses,
  searchQuery,
  pageSize,
  detailOpen,
  keyboardHighlightId,
  applicationsListRef,
  searchInputRef,
  setSelectedCompanies,
  setSelectedStatuses,
  setSearchQuery,
  handleIncludeArchivedChange,
  clearFilters,
  handleViewModeToggle,
  openAddForm,
  handleOpenApplication,
  handlePrefetchNotes,
  handleStatusChange,
  handlePinChange,
  handleCompanyFilter,
  handlePageChange,
  handlePageSizeChange,
  handleCardMouseEnter,
  handleCardMouseLeave,
  onBackToApplications,
  edgeBleedClassName,
  showListFooter: showListFooterProp = true,
  singleColumnCards = false,
}: ApplicationListPageProps) {
  const cardGridClasses = singleColumnCards
    ? APPLICATION_CARD_GRID_SINGLE_COLUMN_CLASSES
    : APPLICATION_CARD_GRID_CLASSES;
  const listFooterVisible =
    applications.length > 0 &&
    !isArchivedViewEmpty &&
    !isBookmarksViewEmpty &&
    !isToApplyViewEmpty &&
    !isFilteredEmpty &&
    hasSyncedPageSize;

  return (
    <section className={cn(showListFooterProp && "flex min-h-0 flex-1 flex-col")}>
      <div className={cn("space-y-4", showListFooterProp && "min-h-0 flex-1 overflow-y-auto")}>
        {applications.length > 0 ? (
          <>
            <ApplicationFilters
              companies={companyNames}
              selectedCompanies={selectedCompanies}
              onSelectedCompaniesChange={setSelectedCompanies}
              selectedStatuses={selectedStatuses}
              onSelectedStatusesChange={setSelectedStatuses}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              includeArchived={includeArchived}
              onIncludeArchivedChange={handleIncludeArchivedChange}
              showIncludeArchived={showIncludeArchived}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              searchInputRef={searchInputRef}
            />
            <div className={cn("py-3", edgeBleedClassName)}>
              <Separator />
            </div>
          </>
        ) : null}
        <div ref={applicationsListRef} className="group/list space-y-4">
          {applications.length === 0 ? (
            <Card className={EMPTY_STATE_CARD_CLASS}>
              <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                <p className="text-muted-foreground text-sm">No applications yet.</p>
                <Button type="button" variant="outline" onClick={openAddForm} title={modKShortcutDescription()}>
                  <PlusIcon data-icon="inline-start" />
                  Add Your First Application
                  <kbd className="bg-muted text-muted-foreground pointer-events-none hidden rounded px-1.5 py-0.5 font-sans text-[0.65rem] font-medium tracking-wide sm:inline">
                    {modKShortcutLabel()}
                  </kbd>
                </Button>
              </CardContent>
            </Card>
          ) : isArchivedViewEmpty ? (
            <Card className={EMPTY_STATE_CARD_CLASS}>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground text-sm">No archived applications.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onBackToApplications ?? handleViewModeToggle}
                >
                  Back To Active Applications
                </Button>
              </CardContent>
            </Card>
          ) : isBookmarksViewEmpty ? (
            <Card className={EMPTY_STATE_CARD_CLASS}>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground text-sm">No bookmarked applications.</p>
                <Button type="button" variant="outline" size="sm" onClick={onBackToApplications ?? clearFilters}>
                  Back To Applications
                </Button>
              </CardContent>
            </Card>
          ) : isToApplyViewEmpty ? (
            <Card className={EMPTY_STATE_CARD_CLASS}>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground text-sm">No To Apply applications.</p>
                <Button type="button" variant="outline" size="sm" onClick={onBackToApplications ?? clearFilters}>
                  Back To Applications
                </Button>
              </CardContent>
            </Card>
          ) : isFilteredEmpty ? (
            <Card className={EMPTY_STATE_CARD_CLASS}>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground text-sm">No applications match the current filters.</p>
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : !hasSyncedPageSize ? (
            <div className={cardGridClasses} aria-busy="true" aria-label="Loading applications">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="bg-card ring-foreground/10 h-[10.5rem] animate-pulse rounded-xl ring-1" />
              ))}
            </div>
          ) : (
            <>
              <div className={cardGridClasses}>
                {visibleApplications.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    keyboardHighlighted={keyboardHighlightId === application.id && !detailOpen}
                    onOpen={handleOpenApplication}
                    onPrefetchNotes={handlePrefetchNotes}
                    onStatusChange={handleStatusChange}
                    onPinChange={handlePinChange}
                    onCompanyFilter={handleCompanyFilter}
                    onMouseEnterCard={handleCardMouseEnter}
                    onMouseLeaveCard={handleCardMouseLeave}
                  />
                ))}
              </div>
              <ApplicationCardPagination
                page={paginatedApplications.page}
                pageSize={pageSize}
                totalPages={paginatedApplications.totalPages}
                rangeStart={paginatedApplications.rangeStart}
                rangeEnd={paginatedApplications.rangeEnd}
                totalCount={paginatedApplications.totalCount}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}
        </div>
      </div>
      {showListFooterProp && listFooterVisible ? (
        <footer className="bg-background hidden shrink-0 sm:block">
          <div className={cn("pt-3", edgeBleedClassName)}>
            <Separator />
          </div>
          <p className="text-muted-foreground pt-3 text-sm">
            <a href="mailto:hello@swoo.io" className="text-blue-600 dark:text-blue-400">
              hello@swoo.io
            </a>
            {" · "}
            <a
              href="https://github.com/tjeastmond/Applied/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400"
            >
              MIT License
            </a>
          </p>
        </footer>
      ) : null}
    </section>
  );
}
