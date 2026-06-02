"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createApplicationNote,
  deleteApplicationNote,
  listApplicationNotes,
  parseJobUrl,
  updateApplication,
} from "@/api";
import { ApplicationFormFields } from "@/components/ApplicationFormFields";
import { JobDescriptionLink } from "@/components/JobDescriptionLink";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { applicationToForm, formatDate, formToInput, isFormValid, type FormState } from "@/lib/applicationForm";
import type { ApplicationNote, JobApplication } from "@/types";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

function formatNoteTimestamp(value: string): string {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ApplicationDetailSheet({
  application,
  open,
  onOpenChange,
  onSaved,
}: {
  application: JobApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [jdOpen, setJdOpen] = useState(false);

  const loadNotes = useCallback(async (applicationId: string) => {
    try {
      setNotes(await listApplicationNotes(applicationId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load notes");
    }
  }, []);

  useEffect(() => {
    if (!application || !open) {
      return;
    }
    setForm(applicationToForm(application));
    setShowValidation(false);
    setNewNote("");
    setJdOpen(false);
    void loadNotes(application.id);
  }, [application, open, loadNotes]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleParse() {
    if (!form?.url.trim()) return;
    setIsParsing(true);
    try {
      const result = await parseJobUrl(form.url.trim());
      if (result.ok) {
        setForm((prev) =>
          prev
            ? {
                ...prev,
                title: result.title ?? prev.title,
                company: result.company ?? prev.company,
                fullJd: result.fullJd ?? prev.fullJd,
              }
            : prev,
        );
        toast.success("Job details parsed.");
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
    if (!form?.id || !isFormValid(form)) {
      setShowValidation(true);
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSaving(true);
    try {
      await updateApplication(form.id, formToInput(form));
      toast.success("Application updated.");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save application");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddNote() {
    if (!application || !newNote.trim()) {
      toast.error("Enter note text before adding.");
      return;
    }
    setIsAddingNote(true);
    try {
      await createApplicationNote(application.id, newNote);
      setNewNote("");
      await loadNotes(application.id);
      toast.success("Note added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!application) return;
    setDeletingNoteId(noteId);
    try {
      await deleteApplicationNote(application.id, noteId);
      await loadNotes(application.id);
      toast.success("Note deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete note");
    } finally {
      setDeletingNoteId(null);
    }
  }

  const headerTitle = form?.title?.trim() || application?.title || application?.company || "Application";
  const postingUrl = form?.url.trim() || application?.url.trim() || "";
  const valid = form ? isFormValid(form) : false;
  const fullJd = form?.fullJd?.trim() || application?.fullJd?.trim();

  return (
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
            {(form?.company?.trim() || application?.company) ? (
              <>
                <span>{form?.company?.trim() || application?.company}</span>
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
                  showValidation={showValidation}
                  isParsing={isParsing}
                  showStatus
                  stackedTitleCompany
                  updateField={updateField}
                  onParse={() => void handleParse()}
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
                          disabled={deletingNoteId === note.id}
                          aria-label="Delete note"
                          onClick={() => void handleDeleteNote(note.id)}
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
                    <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${jdOpen ? "rotate-180" : ""}`} />
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
          <Button
            type="button"
            disabled={isSaving || !valid}
            className="bg-green-600 text-white hover:bg-green-700 focus-visible:border-green-700 focus-visible:ring-green-600/30"
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
