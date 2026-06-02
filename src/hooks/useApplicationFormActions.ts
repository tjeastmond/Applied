"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { parseJobUrl } from "@/api";
import { errorMessage } from "@/lib/errorMessage";
import {
  emptyForm,
  getRequiredValidationState,
  isFormValid,
  mergeParseResult,
  safeFormToInput,
  type FormState,
} from "@/lib/applicationForm";
import { toastMessages } from "@/lib/toastMessages";
import type { ParsedCreateJobApplicationInput } from "@/lib/schemas/application";
import type { JobApplication } from "@/types";
import { toast } from "sonner";

type UseApplicationFormActionsOptions = {
  form: FormState | null;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  parseSuccessMessage?: string;
  saveSuccessMessage?: string;
  onSave: (input: ParsedCreateJobApplicationInput, form: FormState) => Promise<JobApplication | void>;
  onApplicationChange?: (application: JobApplication) => void | Promise<void>;
  requireId?: boolean;
};

export function useApplicationFormActions({
  form,
  setForm,
  parseSuccessMessage = toastMessages.parseSuccessAdd,
  saveSuccessMessage = toastMessages.applicationSaved,
  onSave,
  onApplicationChange,
  requireId = false,
}: UseApplicationFormActionsOptions) {
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const valid = useMemo(() => form !== null && isFormValid(form), [form]);

  const requiredValidation = useMemo(
    () => getRequiredValidationState(form ?? emptyForm(), showValidation && form !== null),
    [form, showValidation],
  );

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [setForm],
  );

  const parse = useCallback(async () => {
    if (!form?.url.trim()) return;
    setIsParsing(true);
    try {
      const result = await parseJobUrl(form.url.trim());
      if (result.ok) {
        setForm((prev) => (prev ? mergeParseResult(prev, result) : prev));
        toast.success(parseSuccessMessage);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.parseUrlFailed));
    } finally {
      setIsParsing(false);
    }
  }, [form?.url, parseSuccessMessage, setForm]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!form || (requireId && !form.id)) {
      setShowValidation(true);
      toast.error(toastMessages.requiredFields);
      return false;
    }

    const parsed = safeFormToInput(form);
    if (!parsed.ok) {
      setShowValidation(true);
      toast.error(toastMessages.requiredFields);
      return false;
    }

    setIsSaving(true);
    try {
      const saved = await onSave(parsed.data, form);
      toast.success(saveSuccessMessage);
      if (saved && onApplicationChange) {
        await onApplicationChange(saved);
      }
      return true;
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.saveFailed));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [form, onApplicationChange, onSave, requireId, saveSuccessMessage]);

  return {
    updateField,
    isParsing,
    isSaving,
    showValidation,
    setShowValidation,
    valid,
    requiredValidation,
    parse,
    save,
  };
}
