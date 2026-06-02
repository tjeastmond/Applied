"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createApplicationNote, deleteApplicationNote, listApplicationNotes, updateApplication } from "@/api";
import { ApplicationFormFields } from "@/components/ApplicationFormFields";
import { JobDescriptionLink } from "@/components/JobDescriptionLink";
import { Button } from "@/components/ui/button";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useApplicationFormActions } from "@/hooks/useApplicationFormActions";
import {
  applicationToForm,
  formatDate,
  formatNoteTimestamp,
  isFormPristine,
  type FormState,
} from "@/lib/applicationForm";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import type { ApplicationNote, JobApplication } from "@/types";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

export function ApplicationDetailSheet({
  application,
  open,
  onOpenChange,
  onApplicationChange,
}: {
  application: JobApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplicationChange: (application: JobApplication) => void;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [jdOpen, setJdOpen] = useState(false);

  const applicationId = application?.id ?? null;
  const applicationRef = useRef(application);
  applicationRef.current = application;

  const loadNotes = useCallback(async (id: string) => {
    try {
      setNotes(await listApplicationNotes(id));
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.notesLoadFailed));
    }
  }, []);

  const { updateField, isParsing, isSaving, requiredValidation, valid, parse, save, setShowValidation } =
    useApplicationFormActions({
      form,
      setForm,
      parseSuccessMessage: toastMessages.parseSuccessDetail,
      saveSuccessMessage: toastMessages.applicationUpdated,
      requireId: true,
      onSave: async (input, currentForm) => {
        if (!currentForm.id) return;
        return updateApplication(currentForm.id, input);
      },
      onApplicationChange: (updated) => {
        onApplicationChange(updated);
        setForm(applicationToForm(updated));
      },
    });

  useEffect(() => {
    if (!applicationId || !open) {
      return;
    }
    const currentApplication = applicationRef.current;
    if (!currentApplication || currentApplication.id !== applicationId) {
      return;
    }
    setForm(applicationToForm(currentApplication));
    setShowValidation(false);
    setNewNote("");
    setJdOpen(false);
    void loadNotes(applicationId);
  }, [applicationId, open, loadNotes, setShowValidation]);

  useEffect(() => {
    if (!applicationId || !open || !application || !form) {
      return;
    }
    if (form.id !== application.id) {
      return;
    }
    if (isFormPristine(form, application)) {
      setForm(applicationToForm(application));
    }
  }, [application?.updatedAt, application, applicationId, form, open]);

  const pendingNote = useMemo(() => notes.find((note) => note.id === pendingNoteId) ?? null, [notes, pendingNoteId]);

  async function handleAddNote() {
    if (!applicationId || !newNote.trim()) {
      toast.error(toastMessages.noteTextRequired);
      return;
    }
    setIsAddingNote(true);
    try {
      const note = await createApplicationNote(applicationId, newNote);
      setNewNote("");
      setNotes((prev) => [note, ...prev]);
      toast.success(toastMessages.noteAdded);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.noteAddFailed));
    } finally {
      setIsAddingNote(false);
    }
  }

  function requestDeleteNote(noteId: string) {
    setPendingNoteId(noteId);
  }

  function handleNoteDeleteDialogOpenChange(dialogOpen: boolean) {
    if (!dialogOpen && !isDeletingNote) {
      setPendingNoteId(null);
    }
  }

  async function confirmDeleteNote() {
    if (!applicationId || !pendingNoteId) return;
    const noteId = pendingNoteId;
    setIsDeletingNote(true);
    try {
      await deleteApplicationNote(applicationId, noteId);
      setPendingNoteId(null);
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      toast.success(toastMessages.noteDeleted);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.noteDeleteFailed));
    } finally {
      setIsDeletingNote(false);
    }
  }

  const headerTitle = form?.title.trim() || application?.title || application?.company || "Application";
  const postingUrl = form?.url.trim() || application?.url.trim() || "";
  const fullJd = form?.fullJd.trim() || application?.fullJd?.trim();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-[60vw] max-w-[60vw] min-w-[60vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[60vw]"
        >
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="pr-8 text-lg">
              {postingUrl ? (
                <a
                  href={postingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground/80 underline underline-offset-4"
                >
                  {headerTitle}
                </a>
              ) : (
                headerTitle
              )}
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-1.5">
              {form?.company.trim() || application?.company ? (
                <>
                  <span>{form?.company.trim() || application?.company}</span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              {application ? <span>{formatDate(application.appliedAt)}</span> : null}
              {postingUrl ? (
                <>
                  <span aria-hidden="true">·</span>
                  <JobDescriptionLink url={postingUrl} />
                </>
              ) : null}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {form ? (
              <div className="space-y-8">
                <section>
                  <h3 className="mb-4 text-sm font-semibold tracking-wide uppercase">Details</h3>
                  <ApplicationFormFields
                    form={form}
                    requiredValidation={requiredValidation}
                    isParsing={isParsing}
                    showStatus
                    stackedTitleCompany
                    updateField={updateField}
                    onParse={() => void parse()}
                  />
                </section>

                <Separator />

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold tracking-wide uppercase">Notes</h3>
                  {notes.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No notes yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {notes.map((note) => (
                        <li key={note.id} className="bg-muted/40 flex gap-3 rounded-lg border px-3 py-3 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap">{note.content}</p>
                            <p className="text-muted-foreground mt-1 text-xs">{formatNoteTimestamp(note.createdAt)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                            disabled={isDeletingNote && pendingNoteId === note.id}
                            aria-label="Delete note"
                            onClick={() => requestDeleteNote(note.id)}
                          >
                            <Trash2Icon />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add a note…"
                      value={newNote}
                      rows={3}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isAddingNote || !newNote.trim()}
                      onClick={() => void handleAddNote()}
                    >
                      {isAddingNote ? "Adding…" : "Add note"}
                    </Button>
                  </div>
                </section>

                <Separator />

                <section>
                  <Collapsible open={jdOpen} onOpenChange={setJdOpen}>
                    <CollapsibleTrigger className="hover:bg-muted/60 flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left text-sm font-semibold tracking-wide uppercase transition-colors">
                      Job Description
                      <ChevronDownIcon
                        className={`size-4 shrink-0 transition-transform ${jdOpen ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      {fullJd ? (
                        <div
                          className="job-description-html bg-muted/30 max-h-[min(50vh,28rem)] overflow-y-auto rounded-lg border p-4"
                          dangerouslySetInnerHTML={{ __html: fullJd }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          No parsed job description. Use Parse on the job URL to fetch one.
                        </p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </section>
              </div>
            ) : null}
          </div>

          <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" variant="save" disabled={isSaving || !valid} onClick={() => void save()}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={pendingNoteId !== null} onOpenChange={handleNoteDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingNote
                ? "This will permanently remove this note. This action cannot be undone."
                : "This will permanently remove this note. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingNote} variant="cancelOutline">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingNote}
              variant="destructiveSolid"
              onClick={() => void confirmDeleteNote()}
            >
              {isDeletingNote ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
