"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bulkFetchApplications, deleteApplication, updateApplication } from "@/api";
import { AddApplicationDialog } from "@/components/AddApplicationDialog";
import { ApplicationCard } from "@/components/ApplicationCard";
import { ApplicationDetailSheet } from "@/components/ApplicationDetailSheet";
import { BackupMenu } from "@/components/BackupMenu";
import { ApplicationCardPagination } from "@/components/ApplicationCardPagination";
import { ApplicationFilters } from "@/components/ApplicationFilters";
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
  paginateItems,
  persistApplicationPageSize,
  readStoredApplicationPageSize,
  type ApplicationPageSize,
} from "@/lib/applicationPagination";
import { uniqueCompanyNames } from "@/lib/companyFilter";
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
import { CopyIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

export function AppPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailClosingIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(() => new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ApplicationStatus>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<ApplicationPageSize>(() => readStoredApplicationPageSize());
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
  } = useApplicationNotesCache();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function onScroll() {
      const list = applicationsListRef.current;
      if (!list) return;
      list.dataset.scrollHoverLocked = "";
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const el = applicationsListRef.current;
        if (el) delete el.dataset.scrollHoverLocked;
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
  const companyNames = useMemo(() => uniqueCompanyNames(applications), [applications]);
  const filteredApplications = useMemo(
    () =>
      filterApplications(applications, {
        selectedCompanies,
        selectedStatuses,
        searchQuery,
      }),
    [applications, selectedCompanies, selectedStatuses, searchQuery],
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
      }),
    [selectedCompanies, selectedStatuses, searchQuery],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCompanies, selectedStatuses, searchQuery]);

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
    let cancelled = false;

    void bulkFetchApplications()
      .then((nextApplications) => {
        if (cancelled) return;
        setApplications(sortApplications(nextApplications));
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(errorMessage(error, toastMessages.applicationsLoadFailed));
      })
      .finally(() => {
        if (cancelled) return;
        setApplicationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
  }, []);

  const requestDelete = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const updateApplicationStatus = useCallback(
    async (id: string, status: ApplicationStatus) => {
      let previousApplication: JobApplication | undefined;

      setApplications((prev) => {
        const application = prev.find((item) => item.id === id);
        if (!application || application.status === status) return prev;
        previousApplication = application;
        return upsertApplication(prev, { ...application, status });
      });

      if (!previousApplication) return;

      const snapshot = previousApplication;

      try {
        const updated = await updateApplication(id, { status });
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.status !== status) return prev;
          return upsertApplication(prev, updated);
        });
        void refetchNotes(id);
      } catch (error) {
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.status !== status) return prev;
          return upsertApplication(prev, snapshot);
        });
        toast.error(errorMessage(error, toastMessages.statusUpdateFailed));
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

  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isDeleting) {
        setPendingDeleteId(null);
      }
    },
    [isDeleting],
  );

  const copyAllUrls = useCallback(async () => {
    const urls = applications.map((application) => application.url.trim()).filter(Boolean);
    if (urls.length === 0) return;

    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      toast.success(toastMessages.allJobUrlsCopied);
    } catch {
      toast.error(toastMessages.allJobUrlsCopyFailed);
    }
  }, [applications]);

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
      setDetailOpen(false);
      setFormOpen(false);
    },
    [clearNotesCacheAll],
  );

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
          <h1 className="text-3xl font-bold tracking-tight">APPLIED.</h1>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <ThemeToggle />
          <BackupMenu onImported={handleBackupImported} />
          <Button
            type="button"
            variant="outline"
            className="header-toolbar-outline"
            disabled={applications.length === 0}
            onClick={() => void copyAllUrls()}
          >
            <CopyIcon data-icon="inline-start" />
            Copy All URLs
          </Button>
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
          {applicationsLoading ? (
            <Card className="shadow-sm shadow-black/5">
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground text-sm">Loading applications…</p>
              </CardContent>
            </Card>
          ) : applications.length === 0 ? (
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
          ) : filteredApplications.length === 0 ? (
            <Card className="shadow-sm shadow-black/5">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground text-sm">No applications match the current filters.</p>
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {visibleApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  onOpen={handleOpenApplication}
                  onPrefetchNotes={handlePrefetchNotes}
                  onStatusChange={handleStatusChange}
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
    </div>
  );
}
