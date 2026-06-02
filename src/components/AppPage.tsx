"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createApplication, deleteApplication, listApplications, parseJobUrl, updateApplication } from "@/api";
import { ApplicationDetailSheet } from "@/components/ApplicationDetailSheet";
import { ApplicationFormFields } from "@/components/ApplicationFormFields";
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
import { errorMessage } from "@/lib/errorMessage";
import { emptyForm, formatDate, formToInput, isFormValid, mergeParseResult, type FormState } from "@/lib/applicationForm";
import {
  isEditableKeyboardTarget,
  isModKeyChord,
  modKShortcutDescription,
  modKShortcutLabel,
} from "@/lib/keyboardShortcut";
import type { JobApplication } from "@/types";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

export function AppPage({ initialApplications }: { initialApplications: JobApplication[] }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [applications, setApplications] = useState(initialApplications);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const valid = isFormValid(form);
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

  const refresh = useCallback(async () => {
    setApplications(await listApplications());
  }, []);

  function resetForm() {
    setForm(emptyForm());
    setShowValidation(false);
  }

  const openAddForm = useCallback(() => {
    resetForm();
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

  function openDetail(application: JobApplication) {
    setSelectedId(application.id);
    setDetailOpen(true);
  }

  function handleDetailOpenChange(open: boolean) {
    setDetailOpen(open);
    if (!open) {
      setSelectedId(null);
    }
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  function handleFormOpenChange(open: boolean) {
    setFormOpen(open);
    if (!open) {
      resetForm();
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleParse() {
    if (!form.url.trim()) return;
    setIsParsing(true);
    try {
      const result = await parseJobUrl(form.url.trim());
      if (result.ok) {
        setForm((prev) => mergeParseResult(prev, result));
        toast.success("Job details parsed. Review and save when ready.");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(errorMessage(error, "Failed to parse URL"));
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSave() {
    if (!valid) {
      setShowValidation(true);
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSaving(true);
    try {
      const input = formToInput(form);
      if (form.id) {
        await updateApplication(form.id, input);
        toast.success("Application updated.");
      } else {
        await createApplication(input);
        toast.success("Application saved.");
      }
      closeForm();
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save application"));
    } finally {
      setIsSaving(false);
    }
  }

  function requestDelete(id: string) {
    setPendingDeleteId(id);
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (!open && !isDeleting) {
      setPendingDeleteId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setIsDeleting(true);
    try {
      await deleteApplication(id);
      setPendingDeleteId(null);
      if (form.id === id) {
        closeForm();
      }
      if (selectedId === id) {
        handleDetailOpenChange(false);
      }
      toast.success("Application deleted.");
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete application"));
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
        <Button type="button" onClick={openAddForm} title={modKShortcutDescription()}>
          <PlusIcon data-icon="inline-start" />
          Add Application
          <kbd className="bg-primary-foreground/15 text-primary-foreground/90 pointer-events-none hidden rounded px-1.5 py-0.5 font-sans text-[0.65rem] font-medium tracking-wide sm:inline">
            {modKShortcutLabel()}
          </kbd>
        </Button>
      </header>

      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 shadow-lg shadow-black/10 sm:max-w-2xl">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
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
                form={form}
                showValidation={showValidation}
                isParsing={isParsing}
                updateField={updateField}
                onParse={() => void handleParse()}
              />
            </div>
            <DialogFooter className="mx-0 mb-0 gap-3 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={closeForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isSaving}
                className="bg-green-600 text-white hover:bg-green-700 focus-visible:border-green-700 focus-visible:ring-green-600/30"
              >
                {isSaving ? "Saving…" : "Save Application"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ApplicationDetailSheet
        application={selectedApplication}
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        onSaved={refresh}
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
            <AlertDialogCancel
              disabled={isDeleting}
              className="border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:border-red-700 focus-visible:ring-red-600/30"
              onClick={() => void confirmDelete()}
            >
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
              onOpen={() => openDetail(application)}
              onDelete={() => requestDelete(application.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function ApplicationCard({
  application,
  onOpen,
  onDelete,
}: {
  application: JobApplication;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const title = application.title || application.url;
  const appliedLabel = formatDate(application.appliedAt);
  const postingUrl = application.url.trim();

  return (
    <Card className="hover:bg-muted/50 relative gap-0 py-0 transition-colors hover:shadow-md hover:shadow-black/5">
      <button
        type="button"
        className="focus-visible:ring-ring/50 absolute inset-0 z-0 cursor-pointer rounded-xl focus-visible:ring-3 focus-visible:outline-none"
        aria-label={`View details for ${title}`}
        onClick={onOpen}
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
        <div className="pointer-events-auto flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700 focus-visible:border-green-700 focus-visible:ring-green-600/30"
            onClick={onOpen}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-red-600 text-white hover:bg-red-700 focus-visible:border-red-700 focus-visible:ring-red-600/30"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
