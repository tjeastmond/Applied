"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createApplication, deleteApplication, updateApplication } from "@/api";
import { ApplicationDetailSheet } from "@/components/ApplicationDetailSheet";
import { ApplicationFormFields } from "@/components/ApplicationFormFields";
import { ApplicationStatusPicker } from "@/components/ApplicationStatusPicker";
import { JobDescriptionLink } from "@/components/JobDescriptionLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApplicationFormActions } from "@/hooks/useApplicationFormActions";
import { useApplicationNotesCache } from "@/hooks/useApplicationNotesCache";
import { removeApplication, upsertApplication } from "@/lib/applicationsList";
import {
  emptyForm,
  formatDate,
  normalizeClipboardOnlyJobUrl,
  type FormState,
} from "@/lib/applicationForm";
import { errorMessage } from "@/lib/errorMessage";
import {
  isEditableKeyboardTarget,
  isModKeyChord,
  modKShortcutDescription,
  modKShortcutLabel,
} from "@/lib/keyboardShortcut";
import { toastMessages } from "@/lib/toastMessages";
import { cn } from "@/lib/utils";
import type { ApplicationStatus, JobApplication } from "@/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CopyIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

export function AppPage({ initialApplications }: { initialApplications: JobApplication[] }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [applications, setApplications] = useState(initialApplications);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailClosingIdRef = useRef<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [scrollHoverLocked, setScrollHoverLocked] = useState(false);
  const addFormUrlInputRef = useRef<HTMLInputElement>(null);
  const parseRef = useRef<(urlOverride?: string) => Promise<void>>(async () => {});
  const { prefetch, prefetchMany, getNotes, isLoading, setNotes, removeApplication: clearNotesCache } =
    useApplicationNotesCache();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function onScroll() {
      setScrollHoverLocked(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setScrollHoverLocked(false), 150);
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

  const { updateField, isParsing, isSaving, requiredValidation, parse, save, setShowValidation } =
    useApplicationFormActions({
      form,
      setForm: setForm as React.Dispatch<React.SetStateAction<FormState | null>>,
      onSave: async (input, currentForm) => {
        if (currentForm.id) {
          return updateApplication(currentForm.id, input);
        }
        return createApplication(input);
      },
      onApplicationChange: handleApplicationChange,
    });
  parseRef.current = parse;

  const resetForm = useCallback(() => {
    setForm(emptyForm());
    setShowValidation(false);
  }, [setShowValidation]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    resetForm();
  }, [resetForm]);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedId) ?? null,
    [applications, selectedId],
  );
  const pendingDeleteApplication = useMemo(
    () => applications.find((application) => application.id === pendingDeleteId) ?? null,
    [applications, pendingDeleteId],
  );

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  useEffect(() => {
    prefetchMany(applications.map((application) => application.id));
  }, [applications, prefetchMany]);

  const openAddForm = useCallback(() => {
    resetForm();
    setFormOpen(true);
  }, [setShowValidation]);

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
    if (!formOpen) return;

    let cancelled = false;

    void (async () => {
      try {
        const text = await navigator.clipboard.readText();
        const url = normalizeClipboardOnlyJobUrl(text);
        if (!url || cancelled) return;

        await parseRef.current(url);
        if (cancelled) return;

        requestAnimationFrame(() => {
          addFormUrlInputRef.current?.blur();
        });
      } catch {
        // Clipboard unavailable or denied — user can paste manually.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formOpen]);

  function openDetail(application: JobApplication) {
    prefetch(application.id, { notifyOnError: true });
    setSelectedId(application.id);
    setDetailOpen(true);
  }

  function handleDetailOpenChange(open: boolean) {
    setDetailOpen(open);
    if (!open) {
      detailClosingIdRef.current = selectedId;
    } else {
      detailClosingIdRef.current = null;
    }
  }

  function handleDetailCloseComplete() {
    const closingId = detailClosingIdRef.current;
    if (closingId === null) return;
    detailClosingIdRef.current = null;
    setSelectedId((current) => (current === closingId ? null : current));
  }

  function handleFormOpenChange(open: boolean) {
    setFormOpen(open);
    if (!open) {
      resetForm();
    }
  }

  function requestDelete(id: string) {
    setPendingDeleteId(id);
  }

  async function handleStatusChange(id: string, status: ApplicationStatus) {
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
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (!open && !isDeleting) {
      setPendingDeleteId(null);
    }
  }

  async function copyAllUrls() {
    const urls = applications.map((application) => application.url.trim()).filter(Boolean);
    if (urls.length === 0) return;

    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      toast.success(toastMessages.allJobUrlsCopied);
    } catch {
      toast.error(toastMessages.allJobUrlsCopyFailed);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setIsDeleting(true);
    try {
      await deleteApplication(id);
      setPendingDeleteId(null);
      clearNotesCache(id);
      setApplications((prev) => removeApplication(prev, id));
      if (form.id === id) {
        closeForm();
      }
      if (selectedId === id) {
        handleDetailOpenChange(false);
      }
      toast.success(toastMessages.applicationDeleted);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.deleteApplicationFailed));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-10 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight">Applied.dev</h1>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
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

      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 shadow-lg shadow-black/10 sm:max-w-2xl">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                if (await save()) {
                  closeForm();
                }
              })();
            }}
          >
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>Add Application</DialogTitle>
              <DialogDescription>
                Fields marked with <span className="text-destructive">*</span> are required.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 py-4">
              <ApplicationFormFields
                variant="minimal"
                autoParseOnUrlPaste
                urlInputRef={addFormUrlInputRef}
                form={form}
                requiredValidation={requiredValidation}
                isParsing={isParsing}
                updateField={updateField}
                onParse={(url) => void parse(url)}
              />
            </div>
            <DialogFooter className="mx-0 mb-0 gap-3 px-6 py-4">
              <Button type="button" variant="cancelOutline" size="lg" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" variant="save" size="lg" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Application"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ApplicationDetailSheet
        application={selectedApplication}
        open={detailOpen}
        notes={selectedId ? (getNotes(selectedId) ?? []) : []}
        notesLoading={selectedId ? isLoading(selectedId) : false}
        onNotesChange={(nextNotes) => {
          if (selectedId) setNotes(selectedId, nextNotes);
        }}
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
        <h2 className="text-lg font-semibold">Applications</h2>
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
        ) : (
          applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              scrollHoverLocked={scrollHoverLocked}
              onOpen={() => openDetail(application)}
              onPrefetchNotes={() => prefetch(application.id)}
              onStatusChange={(status) => void handleStatusChange(application.id, status)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function ApplicationCard({
  application,
  scrollHoverLocked,
  onOpen,
  onPrefetchNotes,
  onStatusChange,
}: {
  application: JobApplication;
  scrollHoverLocked: boolean;
  onOpen: () => void;
  onPrefetchNotes: () => void;
  onStatusChange: (status: ApplicationStatus) => void;
}) {
  const title = application.title || application.url;
  const appliedLabel = formatDate(application.appliedAt);
  const postingUrl = application.url.trim();

  return (
    <Card
      className={cn(
        "relative gap-0 py-0 transition-colors",
        !scrollHoverLocked && "hover:bg-muted/50 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/30",
      )}
    >
      <button
        type="button"
        className={cn(
          "focus-visible:ring-ring/50 absolute inset-0 z-0 rounded-xl focus-visible:ring-3 focus-visible:outline-none",
          scrollHoverLocked ? "cursor-default" : "cursor-pointer",
        )}
        aria-label={`View details for ${title}`}
        onClick={onOpen}
        onMouseEnter={onPrefetchNotes}
        onFocus={onPrefetchNotes}
      />
      <CardHeader className="pointer-events-none relative z-10 flex flex-row items-start justify-between gap-3 space-y-0 py-4">
        <div className="min-w-0 flex-1 space-y-1 text-left">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-1.5">
            {application.company ? (
              <>
                <span>{application.company}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span>{appliedLabel}</span>
            {postingUrl ? (
              <>
                <span aria-hidden="true">·</span>
                <JobDescriptionLink url={postingUrl} className="pointer-events-auto" stopPropagation />
              </>
            ) : null}
          </CardDescription>
        </div>
        <ApplicationStatusPicker
          className="pointer-events-auto"
          status={application.status}
          onStatusChange={onStatusChange}
        />
      </CardHeader>
    </Card>
  );
}
