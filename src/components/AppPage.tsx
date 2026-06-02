"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createApplication, deleteApplication, listApplications, parseJobUrl, updateApplication } from "@/api";
import { ApplicationDetailSheet } from "@/components/ApplicationDetailSheet";
import { ApplicationFormFields } from "@/components/ApplicationFormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applicationToForm,
  emptyForm,
  formatDate,
  formToInput,
  isFormValid,
  type FormState,
} from "@/lib/applicationForm";
import type { JobApplication } from "@/types";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

export function AppPage({ initialApplications }: { initialApplications: JobApplication[] }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [applications, setApplications] = useState(initialApplications);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const valid = isFormValid(form);
  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedId) ?? null,
    [applications, selectedId],
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

  function openAddForm() {
    resetForm();
    setFormOpen(true);
  }

  function openEditForm(application: JobApplication) {
    setForm(applicationToForm(application));
    setShowValidation(false);
    setFormOpen(true);
  }

  function openDetail(application: JobApplication) {
    setSelectedId(application.id);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
    setSelectedId(null);
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
        setForm((prev) => ({
          ...prev,
          title: result.title ?? prev.title,
          company: result.company ?? prev.company,
          fullJd: result.fullJd ?? prev.fullJd,
        }));
        toast.success("Job details parsed. Review and save when ready.");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to parse URL");
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
      toast.error(error instanceof Error ? error.message : "Failed to save application");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this application?")) return;
    try {
      await deleteApplication(id);
      if (form.id === id) {
        closeForm();
      }
      if (selectedId === id) {
        closeDetail();
      }
      toast.success("Application deleted.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete application");
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-10 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight">Applied.dev</h1>
        </div>
        <Button type="button" onClick={openAddForm}>
          <PlusIcon data-icon="inline-start" />
          Add Application
        </Button>
      </header>

      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 shadow-lg shadow-black/10 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{form.id ? "Edit Application" : "Add Application"}</DialogTitle>
            <DialogDescription>
              Fields marked with <RequiredMark /> are required.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4">
            <ApplicationFormFields
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
              type="button"
              size="lg"
              disabled={isSaving || !valid}
              className="bg-green-600 text-white hover:bg-green-700 focus-visible:border-green-700 focus-visible:ring-green-600/30"
              onClick={() => void handleSave()}
            >
              {isSaving ? "Saving…" : form.id ? "Update Application" : "Save Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplicationDetailSheet
        application={selectedApplication}
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        onSaved={refresh}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Applications</h2>
        {applications.length === 0 ? (
          <Card className="shadow-sm shadow-black/5">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-muted-foreground text-sm">No applications yet.</p>
              <Button type="button" variant="outline" onClick={openAddForm}>
                <PlusIcon data-icon="inline-start" />
                Add Your First Application
              </Button>
            </CardContent>
          </Card>
        ) : (
          applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onOpen={() => openDetail(application)}
              onEdit={() => openEditForm(application)}
              onDelete={() => void handleDelete(application.id)}
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
  onEdit,
  onDelete,
}: {
  application: JobApplication;
  onOpen: () => void;
  onEdit: () => void;
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
                <a
                  href={postingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto text-xs text-blue-600 underline underline-offset-4 hover:no-underline dark:text-blue-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  Job posting
                </a>
              </>
            ) : null}
          </CardDescription>
        </div>
        <div className="pointer-events-auto flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700 focus-visible:border-green-700 focus-visible:ring-green-600/30"
            onClick={onEdit}
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
