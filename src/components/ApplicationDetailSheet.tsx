"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createApplicationNote, deleteApplicationNote, updateApplication } from "@/api";
import { ApplicationFormFields } from "@/components/ApplicationFormFields";
import { ApplicationMetadataLine } from "@/components/ApplicationMetadataLine";
import { NoteContent } from "@/components/NoteContent";
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
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import {
  isModKeyChord,
  modEnterShortcutDescription,
  modEnterShortcutLabel,
  modSShortcutDescription,
  modSShortcutLabel,
} from "@/lib/keyboardShortcut";
import { toastMessages } from "@/lib/toastMessages";
import type { ApplicationNote, JobApplication } from "@/types";
import { ChevronDownIcon, CopyIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

export function ApplicationDetailSheet({
  application,
  open,
  notes,
  notesLoading,
  onNotesChange,
  onOpenChange,
  onCloseComplete,
  onApplicationChange,
  onRequestDelete,
}: {
  application: JobApplication | null;
  open: boolean;
  notes: ApplicationNote[];
  notesLoading: boolean;
  onNotesChange: (notes: ApplicationNote[]) => void;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  onApplicationChange: (application: JobApplication) => void;
  onRequestDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState | null>(() =>
    application ? applicationToForm(application) : null,
  );
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [jdOpen, setJdOpen] = useState(false);

  const applicationId = application?.id ?? null;
  const applicationUpdatedAt = application?.updatedAt ?? null;
  const applicationRef = useRef(application);
  applicationRef.current = application;
  const formRef = useRef(form);
  formRef.current = form;
  const syncedUpdatedAtRef = useRef<string | null>(null);
  const syncedApplicationIdRef = useRef<string | null>(null);

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
        if (applicationRef.current?.id !== updated.id) return;
        onApplicationChange(updated);
        setForm(applicationToForm(updated));
        syncedUpdatedAtRef.current = updated.updatedAt;
      },
    });

  useEffect(() => {
    if (!open || !applicationId || !application || application.id !== applicationId) {
      syncedApplicationIdRef.current = null;
      return;
    }

    if (syncedApplicationIdRef.current === applicationId) return;

    syncedApplicationIdRef.current = applicationId;
    setForm(applicationToForm(application));
    syncedUpdatedAtRef.current = application.updatedAt;
    setShowValidation(false);
    setNewNote("");
    setJdOpen(false);
    setPendingNoteId(null);
    setIsAddingNote(false);
    setIsDeletingNote(false);
  }, [application, applicationId, open, setShowValidation]);

  useEffect(() => {
    if (!open || !applicationId || !application || application.id !== applicationId) return;
    if (syncedUpdatedAtRef.current === application.updatedAt) return;

    const currentForm = formRef.current;
    if (currentForm && currentForm.id === applicationId && isFormPristine(currentForm, application)) {
      setForm(applicationToForm(application));
    }
    syncedUpdatedAtRef.current = application.updatedAt;
  }, [application, applicationId, applicationUpdatedAt, open]);

  const pendingNote = useMemo(() => notes.find((note) => note.id === pendingNoteId) ?? null, [notes, pendingNoteId]);

  async function handleAddNote() {
    if (!applicationId || !newNote.trim()) {
      toast.error(toastMessages.noteTextRequired);
      return;
    }
    setIsAddingNote(true);
    try {
      const note = await createApplicationNote(applicationId, newNote);
      if (applicationRef.current?.id !== applicationId) return;
      setNewNote("");
      onNotesChange([...notes, note]);
      toast.success(toastMessages.noteAdded);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.noteAddFailed));
    } finally {
      setIsAddingNote(false);
    }
  }

  function handleNewNoteKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!isModKeyChord(event.nativeEvent, "Enter")) return;
    event.preventDefault();
    if (isAddingNote || !newNote.trim()) return;
    void handleAddNote();
  }

  async function handleCopyNote(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(toastMessages.noteCopied);
    } catch {
      toast.error(toastMessages.noteCopyFailed);
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
      if (applicationRef.current?.id !== applicationId) return;
      setPendingNoteId(null);
      onNotesChange(notes.filter((note) => note.id !== noteId));
      toast.success(toastMessages.noteDeleted);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.noteDeleteFailed));
    } finally {
      setIsDeletingNote(false);
    }
  }

  const formMatchesApplication = form?.id === applicationId;
  const isFormDirty = useMemo(() => {
    if (!form || !application || !formMatchesApplication) return false;
    return !isFormPristine(form, application);
  }, [form, application, formMatchesApplication]);

  useEffect(() => {
    if (!open || !isFormDirty) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!isModKeyChord(event, "s")) return;
      event.preventDefault();
      if (isSaving) return;
      void save();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isFormDirty, isSaving, save]);
  const headerTitle =
    (formMatchesApplication ? form.title.trim() : "") ||
    application?.title ||
    application?.company ||
    "Application";
  const postingUrl = (formMatchesApplication ? form.url.trim() : "") || application?.url.trim() || "";
  const companyLinkedInUrl =
    (formMatchesApplication ? form.linkedinUrl.trim() : "") || application?.linkedinUrl?.trim() || "";
  const fullJd = (formMatchesApplication ? form.fullJd.trim() : "") || application?.fullJd?.trim() || "";

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        onOpenChangeComplete={(isOpen) => {
          if (!isOpen) onCloseComplete?.();
        }}
      >
        <SheetContent
          side="right"
          className="border-border flex w-[60vw] max-w-[60vw] min-w-[60vw] flex-col gap-0 overflow-hidden border-l p-0 sm:max-w-[60vw]"
        >
          <SheetHeader className="gap-2 border-b border-border px-6 py-4">
            <SheetTitle className="pr-8 text-lg">
              {postingUrl ? (
                <a
                  href={postingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-plain inline-flex items-center gap-1.5 hover:text-foreground/80"
                >
                  <span>{headerTitle}</span>
                  <ExternalLinkIcon className="size-[0.95em] shrink-0 opacity-70" aria-hidden="true" />
                </a>
              ) : (
                headerTitle
              )}
            </SheetTitle>
            <ApplicationMetadataLine
              variant="sheet"
              company={
                application
                  ? (formMatchesApplication ? form.company.trim() : "") || application.company
                  : null
              }
              appliedLabel={application ? formatDate(application.appliedAt) : ""}
              linkedinUrl={application ? companyLinkedInUrl : null}
              postingUrl={application ? postingUrl : null}
            />
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {form && formMatchesApplication ? (
              <>
                <div className="px-6 py-4">
                  <ApplicationFormFields
                    form={form}
                    requiredValidation={requiredValidation}
                    isParsing={isParsing}
                    variant="detail"
                    showStatus
                    stackedTitleCompany
                    updateField={updateField}
                    onParse={() => void parse()}
                  />
                </div>

                <Separator />

                <div className="px-6 py-6">
                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold tracking-wide uppercase">Notes</h3>
                    {notesLoading && notes.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Loading notes…</p>
                    ) : null}
                    {!notesLoading && notes.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No notes yet.</p>
                    ) : null}
                    <ul className="space-y-3">
                      {notes.map((note) => (
                        <li key={note.id} className="bg-muted/40 rounded-lg border px-3 py-3 text-sm">
                          <NoteContent content={note.content} />
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="text-muted-foreground text-xs">{formatNoteTimestamp(note.createdAt)}</p>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Copy note"
                                onClick={() => void handleCopyNote(note.content)}
                              >
                                <CopyIcon />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-foreground"
                                disabled={isDeletingNote && pendingNoteId === note.id}
                                aria-label="Delete note"
                                onClick={() => requestDeleteNote(note.id)}
                              >
                                <Trash2Icon />
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                      <li>
                        <Textarea
                          placeholder="Add a note…"
                          value={newNote}
                          rows={3}
                          onChange={(e) => setNewNote(e.target.value)}
                          onKeyDown={handleNewNoteKeyDown}
                        />
                      </li>
                      <li>
                        <Button
                          type="button"
                          variant="saveOutline"
                          className="self-start"
                          disabled={isAddingNote || !newNote.trim()}
                          title={modEnterShortcutDescription()}
                          onClick={() => void handleAddNote()}
                        >
                          {isAddingNote ? "Adding…" : "Add Note"}
                          <kbd className="border-green-600/30 text-green-700/80 pointer-events-none hidden rounded border bg-green-600/10 px-1.5 py-0.5 font-sans text-[0.65rem] font-medium tracking-wide sm:inline dark:text-green-400/90">
                            {modEnterShortcutLabel()}
                          </kbd>
                        </Button>
                      </li>
                    </ul>
                  </section>
                </div>

                <Separator />

                <div className="px-6 py-6">
                  <section>
                    <Collapsible open={jdOpen} onOpenChange={setJdOpen}>
                      <CollapsibleTrigger className="hover:bg-muted/60 flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left text-sm font-semibold tracking-wide uppercase transition-colors">
                        Scraped Job Description
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
              </>
            ) : null}
          </div>

          <SheetFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructiveSolid"
              disabled={!applicationId}
              onClick={() => {
                if (applicationId) onRequestDelete(applicationId);
              }}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                type="button"
                variant="save"
                disabled={isSaving || !valid}
                title={modSShortcutDescription()}
                onClick={() => void save()}
              >
                {isSaving ? "Saving…" : "Save changes"}
                <kbd className="bg-primary-foreground/15 text-primary-foreground/90 pointer-events-none hidden rounded px-1.5 py-0.5 font-sans text-[0.65rem] font-medium tracking-wide sm:inline">
                  {modSShortcutLabel()}
                </kbd>
              </Button>
            </div>
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
