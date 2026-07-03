"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { deleteApplication, updateApplication } from "@/api";
import { AddApplicationDialog } from "@/components/AddApplicationDialog";
import { ApplicationCard } from "@/components/ApplicationCard";
import { ApplicationDetailSheet } from "@/components/ApplicationDetailSheet";
import { AdminDialog } from "@/components/AdminDialog";
import { ApplicationCardPagination } from "@/components/ApplicationCardPagination";
import { ApplicationFilters } from "@/components/ApplicationFilters";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApplicationNotesCache } from "@/hooks/useApplicationNotesCache";
import { removeApplication, sortApplications, upsertApplication } from "@/lib/applicationsList";
import { filterApplications, hasActiveApplicationFilters } from "@/lib/applicationFilters";
import {
  applicationMatchesViewMode,
  archiveViewToggleLabel,
  nextViewMode,
  partitionApplicationsByView,
  persistApplicationViewMode,
  readStoredApplicationViewMode,
  readStoredIncludeArchived,
  persistIncludeArchived,
  statusFiltersForViewMode,
  type ApplicationViewMode,
} from "@/lib/applicationArchive";
import { uniqueCompanyNames } from "@/lib/companyFilter";
import {
  paginateItems,
  persistApplicationPageSize,
  readStoredApplicationPageSize,
  type ApplicationPageSize,
} from "@/lib/applicationPagination";
import {
  canHandleApplicationCardNavigation,
  cardNavigationKeyFromEvent,
  resolveNextCardId,
} from "@/lib/applicationCardNavigation";
import { errorMessage } from "@/lib/errorMessage";
import {
  consumeDoubleEscape,
  isEditableKeyboardTarget,
  isModKeyChord,
  isSearchFocusSlash,
  modKShortcutDescription,
  modKShortcutLabel,
} from "@/lib/keyboardShortcut";
import { toastMessages } from "@/lib/toastMessages";
import type { ApplicationNote, ApplicationStatus, JobApplication } from "@/types";
import { LogOutIcon, ArchiveIcon, ArchiveRestoreIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

type AuthenticatedAppProps = {
  initialApplications: JobApplication[];
  initialNotesByApplicationId: Record<string, ApplicationNote[]>;
  initialPageSize: ApplicationPageSize;
  initialPageSizeFromPreference: boolean;
  tursoSyncAvailable: boolean;
  onLogout: () => void;
};

let hasRestoredApplicationPageSizePreference = false;
let hasRestoredApplicationViewModePreference = false;
let hasRestoredIncludeArchivedPreference = false;

export function AuthenticatedApp({
  initialApplications,
  initialNotesByApplicationId,
  initialPageSize,
  initialPageSizeFromPreference,
  tursoSyncAvailable,
  onLogout,
}: AuthenticatedAppProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [applications, setApplications] = useState<JobApplication[]>(() => initialApplications);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keyboardHighlightId, setKeyboardHighlightId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailClosingIdRef = useRef<string | null>(null);
  const hoveredCardIdRef = useRef<string | null>(null);
  const keyboardHighlightIdRef = useRef(keyboardHighlightId);
  keyboardHighlightIdRef.current = keyboardHighlightId;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(() => new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ApplicationStatus>>(() => new Set());
  const [viewMode, setViewMode] = useState<ApplicationViewMode>("active");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<ApplicationPageSize>(initialPageSize);
  const [hasSyncedPageSize, setHasSyncedPageSize] = useState(
    () => initialPageSizeFromPreference || hasRestoredApplicationPageSizePreference,
  );
  const applicationsListRef = useRef<HTMLDivElement>(null);
  const lastEscapeAtRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    prefetch,
    prefetchMany,
    notesByApplicationId,
    isLoading,
    setNotes,
    refetch: refetchNotes,
    removeApplication: clearNotesCache,
    clearAll: clearNotesCacheAll,
  } = useApplicationNotesCache({ initialNotesByApplicationId });

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
    if (hasRestoredApplicationViewModePreference) {
      return;
    }

    const storedViewMode = readStoredApplicationViewMode();
    if (storedViewMode === "archived") {
      setViewMode("archived");
      setSelectedStatuses(statusFiltersForViewMode("archived"));
    }

    hasRestoredApplicationViewModePreference = true;
  }, []);

  useLayoutEffect(() => {
    if (hasRestoredIncludeArchivedPreference) {
      return;
    }

    setIncludeArchived(readStoredIncludeArchived());
    hasRestoredIncludeArchivedPreference = true;
  }, []);

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function onScroll() {
      const list = applicationsListRef.current;
      if (!list) return;
      hoveredCardIdRef.current = null;
      list.dataset.scrollHoverLocked = "";
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const el = applicationsListRef.current;
        if (el && !keyboardHighlightIdRef.current) delete el.dataset.scrollHoverLocked;
      }, 150);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timeout);
    };
  }, []);

  const handleApplicationChange = useCallback(
    (application: JobApplication) => {
      let statusChanged = false;

      setApplications((prev) => {
        const existing = prev.find((item) => item.id === application.id);
        statusChanged = existing !== undefined && existing.status !== application.status;
        return upsertApplication(prev, application);
      });

      if (statusChanged) {
        void refetchNotes(application.id);
      }
    },
    [refetchNotes],
  );

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedId) ?? null,
    [applications, selectedId],
  );
  const pendingDeleteApplication = useMemo(
    () => applications.find((application) => application.id === pendingDeleteId) ?? null,
    [applications, pendingDeleteId],
  );
  const selectedNotes = useMemo(
    () => (selectedId ? (notesByApplicationId[selectedId] ?? []) : []),
    [selectedId, notesByApplicationId],
  );
  const selectedNotesLoading = useMemo(() => {
    if (!selectedId) return false;
    return isLoading(selectedId) || notesByApplicationId[selectedId] === undefined;
  }, [selectedId, notesByApplicationId, isLoading]);
  const viewApplications = useMemo(
    () => partitionApplicationsByView(applications, viewMode, includeArchived),
    [applications, viewMode, includeArchived],
  );
  const companyNames = useMemo(() => uniqueCompanyNames(viewApplications), [viewApplications]);
  const filteredApplications = useMemo(
    () =>
      filterApplications(viewApplications, {
        selectedCompanies,
        selectedStatuses,
        searchQuery,
      }),
    [viewApplications, selectedCompanies, selectedStatuses, searchQuery],
  );
  const paginatedApplications = useMemo(
    () => paginateItems(filteredApplications, currentPage, pageSize),
    [filteredApplications, currentPage, pageSize],
  );
  const visibleApplications = paginatedApplications.items;
  const visibleApplicationIds = useMemo(
    () => visibleApplications.map((application) => application.id),
    [visibleApplications],
  );
  const hasActiveFilters = useMemo(
    () =>
      hasActiveApplicationFilters({
        selectedCompanies,
        selectedStatuses,
        searchQuery,
        viewMode,
        includeArchived,
      }),
    [selectedCompanies, selectedStatuses, searchQuery, viewMode, includeArchived],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCompanies, selectedStatuses, searchQuery, viewMode, includeArchived]);

  useEffect(() => {
    if (!selectedApplication || !detailOpen) return;

    if (!applicationMatchesViewMode(selectedApplication, viewMode, includeArchived)) {
      setDetailOpen(false);
    }
  }, [detailOpen, includeArchived, selectedApplication, viewMode]);

  useEffect(() => {
    if (paginatedApplications.page !== currentPage) {
      setCurrentPage(paginatedApplications.page);
    }
  }, [currentPage, paginatedApplications.page]);

  useEffect(() => {
    setSelectedCompanies((prev) => {
      if (prev.size === 0) return prev;
      const available = new Set(companyNames);
      const next = new Set([...prev].filter((name) => available.has(name)));
      return next.size === prev.size ? prev : next;
    });
  }, [companyNames]);

  useEffect(() => {
    prefetchMany(visibleApplicationIds);
  }, [visibleApplicationIds, prefetchMany]);

  const openAddForm = useCallback(() => {
    setFormOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isModKeyChord(event, "k")) return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      openAddForm();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openAddForm]);

  useEffect(() => {
    if (applications.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!isSearchFocusSlash(event)) return;
      if (formOpen || detailOpen || pendingDeleteId !== null) return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applications.length, detailOpen, formOpen, pendingDeleteId]);

  const handleOpenApplication = useCallback(
    (id: string) => {
      void prefetch(id, { notifyOnError: true });
      setSelectedId(id);
      setDetailOpen(true);
    },
    [prefetch],
  );

  const handlePrefetchNotes = useCallback(
    (id: string) => {
      void prefetch(id);
    },
    [prefetch],
  );

  const handleDetailOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      detailClosingIdRef.current = selectedIdRef.current;
    } else {
      detailClosingIdRef.current = null;
    }
  }, []);

  const handleDetailCloseComplete = useCallback(() => {
    const closingId = detailClosingIdRef.current;
    if (closingId === null) return;
    detailClosingIdRef.current = null;
    setSelectedId((current) => (current === closingId ? null : current));
    if (visibleApplicationIds.includes(closingId)) {
      setKeyboardHighlightId(closingId);
    }
  }, [visibleApplicationIds]);

  const requestDelete = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const updateApplicationStatus = useCallback(
    async (id: string, status: ApplicationStatus): Promise<JobApplication | null> => {
      let previousApplication: JobApplication | undefined;

      setApplications((prev) => {
        const application = prev.find((item) => item.id === id);
        if (!application || application.status === status) return prev;
        previousApplication = application;
        return upsertApplication(prev, { ...application, status });
      });

      if (!previousApplication) return null;

      const snapshot = previousApplication;

      try {
        const updated = await updateApplication(id, { status });
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.status !== status) return prev;
          return upsertApplication(prev, updated);
        });
        void refetchNotes(id);
        return updated;
      } catch (error) {
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.status !== status) return prev;
          return upsertApplication(prev, snapshot);
        });
        toast.error(errorMessage(error, toastMessages.statusUpdateFailed));
        return null;
      }
    },
    [refetchNotes],
  );

  const handleStatusChange = useCallback(
    (id: string, status: ApplicationStatus) => {
      void updateApplicationStatus(id, status);
    },
    [updateApplicationStatus],
  );

  const handlePinChange = useCallback((id: string, pinned: boolean) => {
    void (async () => {
      let previousApplication: JobApplication | undefined;

      setApplications((prev) => {
        const application = prev.find((item) => item.id === id);
        if (!application || application.pinned === pinned) return prev;
        previousApplication = application;
        return upsertApplication(prev, { ...application, pinned });
      });

      if (!previousApplication) return;

      const snapshot = previousApplication;

      try {
        const updated = await updateApplication(id, { pinned });
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.pinned !== pinned) return prev;
          return upsertApplication(prev, updated);
        });
      } catch (error) {
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.pinned !== pinned) return prev;
          return upsertApplication(prev, snapshot);
        });
        toast.error(
          errorMessage(error, pinned ? toastMessages.applicationPinFailed : toastMessages.applicationUnpinFailed),
        );
      }
    })();
  }, []);

  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isDeleting) {
        setPendingDeleteId(null);
      }
    },
    [isDeleting],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setIsDeleting(true);
    try {
      await deleteApplication(id);
      setPendingDeleteId(null);
      clearNotesCache(id);
      setApplications((prev) => removeApplication(prev, id));
      if (selectedId === id) {
        handleDetailOpenChange(false);
      }
      toast.success(toastMessages.applicationDeleted);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.deleteApplicationFailed));
    } finally {
      setIsDeleting(false);
    }
  }, [pendingDeleteId, clearNotesCache, selectedId, handleDetailOpenChange]);

  const handleBackupImported = useCallback(
    (nextApplications: JobApplication[]) => {
      setApplications(sortApplications(nextApplications));
      clearNotesCacheAll();
      setCurrentPage(1);
      setSelectedId(null);
      setKeyboardHighlightId(null);
      setDetailOpen(false);
      setFormOpen(false);
    },
    [clearNotesCacheAll],
  );

  const handleApplicationsUpdated = useCallback((nextApplications: JobApplication[]) => {
    setApplications(sortApplications(nextApplications));
  }, []);

  const handleNotesChange = useCallback(
    (nextNotes: ApplicationNote[]) => {
      const id = selectedIdRef.current;
      if (id) setNotes(id, nextNotes);
    },
    [setNotes],
  );

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
    applicationsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handlePageSizeChange = useCallback((nextPageSize: ApplicationPageSize) => {
    setPageSize(nextPageSize);
    persistApplicationPageSize(nextPageSize);
    setCurrentPage(1);
    applicationsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleCardMouseEnter = useCallback((id: string) => {
    hoveredCardIdRef.current = id;
    setKeyboardHighlightId(null);
  }, []);

  const handleCardMouseLeave = useCallback(() => {
    hoveredCardIdRef.current = null;
  }, []);

  const scrollCardIntoView = useCallback((id: string) => {
    const card = applicationsListRef.current?.querySelector<HTMLElement>(`[data-application-id="${id}"]`);
    card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!keyboardHighlightId) return;
    if (visibleApplicationIds.includes(keyboardHighlightId)) return;
    setKeyboardHighlightId(null);
  }, [keyboardHighlightId, visibleApplicationIds]);

  useEffect(() => {
    const list = applicationsListRef.current;
    if (!list) return;
    if (keyboardHighlightId) {
      list.dataset.scrollHoverLocked = "";
    } else {
      delete list.dataset.scrollHoverLocked;
    }
  }, [keyboardHighlightId]);

  useEffect(() => {
    function onMouseMove() {
      if (keyboardHighlightIdRef.current === null) return;
      setKeyboardHighlightId(null);
      hoveredCardIdRef.current = null;
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-application-id]")) return;
      hoveredCardIdRef.current = null;
    }

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (visibleApplications.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      const navKey = cardNavigationKeyFromEvent(event);
      if (!navKey) return;

      if (
        !canHandleApplicationCardNavigation({
          formOpen,
          detailOpen,
          pendingDeleteId,
          visibleCardCount: visibleApplications.length,
          target: event.target,
        })
      ) {
        return;
      }

      if (navKey === "enter") {
        const highlightId = keyboardHighlightIdRef.current;
        if (!highlightId) return;
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        handleOpenApplication(highlightId);
        return;
      }

      event.preventDefault();
      const currentId = keyboardHighlightIdRef.current;
      const nextId = resolveNextCardId(visibleApplicationIds, currentId, navKey, hoveredCardIdRef.current);
      if (!nextId || nextId === currentId) return;
      const list = applicationsListRef.current;
      if (list) list.dataset.scrollHoverLocked = "";
      setKeyboardHighlightId(nextId);
      scrollCardIntoView(nextId);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailOpen, formOpen, handleOpenApplication, pendingDeleteId, scrollCardIntoView, visibleApplicationIds]);

  useEffect(() => {
    if (!hasActiveFilters || applications.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (formOpen || detailOpen || pendingDeleteId !== null) {
        lastEscapeAtRef.current = null;
        return;
      }
      if (!consumeDoubleEscape(event, lastEscapeAtRef)) return;
      event.preventDefault();
      clearFilters();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applications.length, clearFilters, detailOpen, formOpen, hasActiveFilters, pendingDeleteId]);

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-10 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight">
            <button
              type="button"
              className="hover:text-foreground/80 cursor-pointer transition-colors"
              aria-label="Clear filters and go to first page"
              onClick={resetToHome}
            >
              APPLIED.
            </button>
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="header-toolbar-outline"
            onClick={handleViewModeToggle}
            aria-label={archiveViewToggleLabel(viewMode)}
            title={archiveViewToggleLabel(viewMode)}
          >
            {viewMode === "active" ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="header-toolbar-outline"
            onClick={onLogout}
            aria-label="Log out"
            title="Log Out"
          >
            <LogOutIcon />
          </Button>
          <AdminDialog
            applications={applications}
            onImported={handleBackupImported}
            onApplicationsUpdated={handleApplicationsUpdated}
            tursoSyncAvailable={tursoSyncAvailable}
          />
          <Button type="button" onClick={openAddForm} title={modKShortcutDescription()}>
            <PlusIcon data-icon="inline-start" />
            Add Application
            <kbd className="bg-primary-foreground/15 text-primary-foreground/90 pointer-events-none hidden rounded px-1.5 py-0.5 font-sans text-[0.65rem] font-medium tracking-wide sm:inline">
              {modKShortcutLabel()}
            </kbd>
          </Button>
        </div>
      </header>

      <AddApplicationDialog open={formOpen} onOpenChange={setFormOpen} onApplicationCreated={handleApplicationChange} />

      <ApplicationDetailSheet
        application={selectedApplication}
        open={detailOpen}
        notes={selectedNotes}
        notesLoading={selectedNotesLoading}
        onNotesChange={handleNotesChange}
        onOpenChange={handleDetailOpenChange}
        onCloseComplete={handleDetailCloseComplete}
        onApplicationChange={handleApplicationChange}
        onStatusChange={handleStatusChange}
        onRequestDelete={requestDelete}
      />

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteApplication
                ? `This will permanently remove "${pendingDeleteApplication.title || pendingDeleteApplication.url}". This action cannot be undone.`
                : "This will permanently remove this application. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} variant="cancelOutline">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} variant="destructiveSolid" onClick={() => void confirmDelete()}>
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="space-y-4">
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
              includeArchivedDisabled={viewMode === "archived"}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              searchInputRef={searchInputRef}
            />
            <div className="py-3">
              <Separator />
            </div>
          </>
        ) : null}
        <div ref={applicationsListRef} className="group/list space-y-4">
          {applications.length === 0 ? (
            <Card className="shadow-sm shadow-black/5">
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
          ) : viewMode === "archived" && viewApplications.length === 0 ? (
            <Card className="shadow-sm shadow-black/5">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground text-sm">No archived applications.</p>
                <Button type="button" variant="outline" size="sm" onClick={handleViewModeToggle}>
                  Back To Active Applications
                </Button>
              </CardContent>
            </Card>
          ) : filteredApplications.length === 0 ? (
            <Card className="shadow-sm shadow-black/5">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground text-sm">No applications match the current filters.</p>
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : !hasSyncedPageSize ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading applications">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="bg-card ring-foreground/10 h-[10.5rem] animate-pulse rounded-xl ring-1" />
              ))}
            </div>
          ) : (
            <>
              {visibleApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  keyboardHighlighted={keyboardHighlightId === application.id && !detailOpen}
                  onOpen={handleOpenApplication}
                  onPrefetchNotes={handlePrefetchNotes}
                  onStatusChange={handleStatusChange}
                  onPinChange={handlePinChange}
                  onMouseEnterCard={handleCardMouseEnter}
                  onMouseLeaveCard={handleCardMouseLeave}
                />
              ))}
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
              <div className="py-3">
                <Separator />
              </div>
              <p className="text-muted-foreground text-sm">
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
            </>
          )}
        </div>
      </section>
      <KeyboardShortcutsHelp detailDrawerActive={detailOpen || selectedId !== null} />
    </div>
  );
}
