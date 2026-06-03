"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteApplication, updateApplication } from "@/api";
import { AddApplicationDialog } from "@/components/AddApplicationDialog";
import { ApplicationCard } from "@/components/ApplicationCard";
import { ApplicationDetailSheet } from "@/components/ApplicationDetailSheet";
import { BackupMenu } from "@/components/BackupMenu";
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
import { removeApplication, upsertApplication } from "@/lib/applicationsList";
import { filterApplications, hasActiveApplicationFilters } from "@/lib/applicationFilters";
import { uniqueCompanyNames } from "@/lib/companyFilter";
import { errorMessage } from "@/lib/errorMessage";
import {
  isEditableKeyboardTarget,
  isModKeyChord,
  modKShortcutDescription,
  modKShortcutLabel,
} from "@/lib/keyboardShortcut";
import { toastMessages } from "@/lib/toastMessages";
import type { ApplicationNote, ApplicationStatus, JobApplication } from "@/types";
import { CopyIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

export function AppPage({ initialApplications }: { initialApplications: JobApplication[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [applications, setApplications] = useState(initialApplications);
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
  const applicationsListRef = useRef<HTMLDivElement>(null);
  const {
    prefetch,
    prefetchMany,
    notesByApplicationId,
    isLoading,
    setNotes,
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

  const handleApplicationChange = useCallback((application: JobApplication) => {
    setApplications((prev) => upsertApplication(prev, application));
  }, []);

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
    setSelectedCompanies((prev) => {
      if (prev.size === 0) return prev;
      const available = new Set(companyNames);
      const next = new Set([...prev].filter((name) => available.has(name)));
      return next.size === prev.size ? prev : next;
    });
  }, [companyNames]);

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  useEffect(() => {
    prefetchMany(applications.map((application) => application.id));
  }, [applications, prefetchMany]);

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

  const handleOpenApplication = useCallback(
    (id: string) => {
      prefetch(id, { notifyOnError: true });
      setSelectedId(id);
      setDetailOpen(true);
    },
    [prefetch],
  );

  const handlePrefetchNotes = useCallback(
    (id: string) => {
      prefetch(id);
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

  const handleStatusChange = useCallback(async (id: string, status: ApplicationStatus) => {
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
    } catch (error) {
      setApplications((prev) => {
        const current = prev.find((item) => item.id === id);
        if (!current || current.status !== status) return prev;
        return upsertApplication(prev, snapshot);
      });
      toast.error(errorMessage(error, toastMessages.statusUpdateFailed));
    }
  }, []);

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
      setApplications(nextApplications);
      clearNotesCacheAll();
      prefetchMany(nextApplications.map((application) => application.id));
      setSelectedId(null);
      setDetailOpen(false);
      setFormOpen(false);
    },
    [clearNotesCacheAll, prefetchMany],
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

      <AddApplicationDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onApplicationCreated={handleApplicationChange}
      />

      <ApplicationDetailSheet
        application={selectedApplication}
        open={detailOpen}
        notes={selectedNotes}
        notesLoading={selectedNotesLoading}
        onNotesChange={handleNotesChange}
        onOpenChange={handleDetailOpenChange}
        onCloseComplete={handleDetailCloseComplete}
        onApplicationChange={handleApplicationChange}
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
              {filteredApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  onOpen={handleOpenApplication}
                  onPrefetchNotes={handlePrefetchNotes}
                  onStatusChange={handleStatusChange}
                />
              ))}
              <div className="py-3">
                <Separator />
              </div>
              <p className="text-muted-foreground text-sm">
                <a href="mailto:hello@swoo.io" className="text-blue-600 dark:text-blue-400">
                  hello@swoo.io
                </a>
                {" · "}
                © 2026 · MIT License
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
