"use client";

import { createApplication } from "@/api";
import { ApplicationFormFields } from "@/components/ApplicationFormFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApplicationFormActions } from "@/hooks/useApplicationFormActions";
import { emptyForm, normalizeClipboardOnlyJobUrl, type FormState } from "@/lib/applicationForm";
import type { JobApplication } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

export function AddApplicationDialog({
  open,
  onOpenChange,
  onApplicationCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplicationCreated: (application: JobApplication) => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const addFormUrlInputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const parseRef = useRef<(urlOverride?: string) => Promise<boolean>>(() => Promise.resolve(false));

  const handleApplicationChange = useCallback(
    (application: JobApplication) => {
      onApplicationCreated(application);
    },
    [onApplicationCreated],
  );

  const { updateField, isParsing, isSaving, requiredValidation, parse, save, setShowValidation } =
    useApplicationFormActions({
      form,
      setForm: setForm as React.Dispatch<React.SetStateAction<FormState | null>>,
      onSave: async (input) => createApplication(input),
      onApplicationChange: handleApplicationChange,
    });
  parseRef.current = parse;

  const resetForm = useCallback(() => {
    setForm(emptyForm());
    setShowValidation(false);
  }, [setShowValidation]);

  const close = useCallback(() => {
    onOpenChange(false);
    resetForm();
  }, [onOpenChange, resetForm]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) resetForm();
    },
    [onOpenChange, resetForm],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void (async () => {
      try {
        const text = await navigator.clipboard.readText();
        const url = normalizeClipboardOnlyJobUrl(text);
        if (!url || cancelled) return;

        const parsed = await parseRef.current(url);
        if (!parsed || cancelled) return;

        requestAnimationFrame(() => {
          saveButtonRef.current?.focus();
        });
      } catch {
        // Clipboard unavailable or denied — user can paste manually.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 shadow-lg shadow-black/10 sm:max-w-2xl">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              if (await save()) {
                close();
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
          <DialogFooter className="mx-0 mb-0 items-center gap-3 px-6 py-4">
            <Button type="button" variant="cancelOutline" size="lg" onClick={close}>
              Cancel
            </Button>
            <Button ref={saveButtonRef} type="submit" variant="save" size="lg" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
