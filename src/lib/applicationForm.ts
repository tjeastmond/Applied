import { formatZodError } from "@/lib/formatZodError";
import {
  createJobApplicationSchema,
  requiredApplicationFieldsSchema,
  type ParsedCreateJobApplicationInput,
} from "@/lib/schemas/application";
import type {
  ApplicationSalaryFormFields,
  ApplicationStatus,
  JobApplication,
  ParsedApplicationSalaryFields,
  ParseJobUrlSuccess,
} from "@/types";

export type FormState = ApplicationSalaryFormFields & {
  id?: string;
  url: string;
  linkedinUrl: string;
  title: string;
  company: string;
  appliedAt: string;
  recruiterName: string;
  recruiterFirm: string;
  contactEmail: string;
  contactPhone: string;
  fullJd: string;
  status: ApplicationStatus;
};

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function emptyForm(): FormState {
  return {
    url: "",
    linkedinUrl: "",
    title: "",
    company: "",
    appliedAt: today(),
    recruiterName: "",
    recruiterFirm: "",
    contactEmail: "",
    contactPhone: "",
    salaryRange: "",
    desiredSalary: "",
    fullJd: "",
    status: "applied",
  };
}

export function isProbablyHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns a normalized http(s) URL for pasted text, or null if it cannot be parsed. */
export function normalizePastedJobUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isProbablyHttpUrl(trimmed)) return trimmed;

  const withScheme = `https://${trimmed.replace(/^\/+/, "")}`;
  return isProbablyHttpUrl(withScheme) ? withScheme : null;
}

/** Like {@link normalizePastedJobUrl}, but only when the clipboard text is a single URL (no extra lines or prose). */
export function normalizeClipboardOnlyJobUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;
  return normalizePastedJobUrl(trimmed);
}

export const REQUIRED_FORM_FIELDS = ["url", "title", "company", "appliedAt"] as const;

export type RequiredFormField = (typeof REQUIRED_FORM_FIELDS)[number];

const REQUIRED_FIELD_MESSAGES: Record<RequiredFormField, string> = {
  url: "Job Description URL is required.",
  title: "Title is required.",
  company: "Company is required.",
  appliedAt: "Apply date is required.",
};

function requiredFieldsFromForm(form: FormState) {
  return {
    url: form.url,
    title: form.title,
    company: form.company,
    appliedAt: form.appliedAt,
  };
}

function emptyRequiredInvalid(): Record<RequiredFormField, boolean> {
  return { url: false, title: false, company: false, appliedAt: false };
}

export type RequiredValidationState = {
  invalid: Record<RequiredFormField, boolean>;
  errors: Partial<Record<RequiredFormField, string>>;
};

export function getRequiredValidationState(form: FormState, showValidation: boolean): RequiredValidationState {
  if (!showValidation) {
    return { invalid: emptyRequiredInvalid(), errors: {} };
  }

  const result = requiredApplicationFieldsSchema.safeParse(requiredFieldsFromForm(form));
  if (result.success) {
    return { invalid: emptyRequiredInvalid(), errors: {} };
  }

  const invalid = emptyRequiredInvalid();
  const errors: Partial<Record<RequiredFormField, string>> = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !(field in REQUIRED_FIELD_MESSAGES)) {
      continue;
    }
    const key = field as RequiredFormField;
    if (errors[key]) {
      continue;
    }
    invalid[key] = true;
    errors[key] = REQUIRED_FIELD_MESSAGES[key];
  }

  return { invalid, errors };
}

export function isFormValid(form: FormState): boolean {
  return requiredApplicationFieldsSchema.safeParse(requiredFieldsFromForm(form)).success;
}

function buildCreateInput(form: FormState) {
  const hasRecruiterInfo = Boolean(form.recruiterName.trim()) || Boolean(form.recruiterFirm.trim());
  return {
    url: form.url,
    title: form.title,
    company: form.company,
    appliedAt: form.appliedAt,
    linkedinUrl: form.linkedinUrl,
    viaRecruiter: hasRecruiterInfo,
    recruiterName: hasRecruiterInfo ? form.recruiterName : null,
    recruiterFirm: hasRecruiterInfo ? form.recruiterFirm : null,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
    salaryRange: form.salaryRange,
    desiredSalary: form.desiredSalary,
    fullJd: form.fullJd,
    status: form.status,
  };
}

export function safeFormToInput(
  form: FormState,
): { ok: true; data: ParsedCreateJobApplicationInput } | { ok: false; error: string } {
  const result = createJobApplicationSchema.safeParse(buildCreateInput(form));
  if (!result.success) {
    return { ok: false, error: formatZodError(result.error) };
  }
  return { ok: true, data: result.data };
}

const FORM_FIELD_KEYS = [
  "url",
  "linkedinUrl",
  "title",
  "company",
  "appliedAt",
  "recruiterName",
  "recruiterFirm",
  "contactEmail",
  "contactPhone",
  "salaryRange",
  "desiredSalary",
  "fullJd",
  "status",
] as const satisfies readonly (keyof FormState)[];

function formFieldDiffers(
  form: FormState,
  application: JobApplication,
  exclude: ReadonlySet<(typeof FORM_FIELD_KEYS)[number]> = new Set(),
): boolean {
  const baseline = applicationToForm(application);
  return FORM_FIELD_KEYS.some((field) => !exclude.has(field) && form[field] !== baseline[field]);
}

export function isFormPristine(form: FormState, application: JobApplication): boolean {
  return !formFieldDiffers(form, application);
}

/** Dirty check for fields that still require an explicit save (status auto-saves in the detail sheet). */
export function isManualSaveFormDirty(form: FormState, application: JobApplication): boolean {
  return formFieldDiffers(form, application, new Set(["status"]));
}

/** True when status differs but every manual-save field matches the saved application. */
export function isStatusOnlyFormChange(form: FormState, application: JobApplication): boolean {
  return !isFormPristine(form, application) && !isManualSaveFormDirty(form, application);
}

export function mergeParseResult(
  form: FormState,
  result: Pick<ParseJobUrlSuccess, "title" | "company" | "fullJd"> & ParsedApplicationSalaryFields,
): FormState {
  return {
    ...form,
    title: result.title ?? form.title,
    company: result.company ?? form.company,
    salaryRange: result.salaryRange ?? form.salaryRange,
    fullJd: result.fullJd ?? form.fullJd,
  };
}

export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatNoteTimestamp(value: string): string {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formToInput(form: FormState): ParsedCreateJobApplicationInput {
  const result = safeFormToInput(form);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

export function applicationToForm(application: JobApplication): FormState {
  return {
    id: application.id,
    url: application.url,
    linkedinUrl: application.linkedinUrl ?? "",
    title: application.title ?? "",
    company: application.company ?? "",
    appliedAt: application.appliedAt,
    recruiterName: application.recruiterName ?? "",
    recruiterFirm: application.recruiterFirm ?? "",
    contactEmail: application.contactEmail ?? "",
    contactPhone: application.contactPhone ?? "",
    salaryRange: application.salaryRange ?? "",
    desiredSalary: application.desiredSalary ?? "",
    fullJd: application.fullJd ?? "",
    status: application.status,
  };
}
