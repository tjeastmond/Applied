import { formatZodError } from "@/lib/formatZodError";
import {
  createJobApplicationSchema,
  requiredApplicationFieldsSchema,
  type ParsedCreateJobApplicationInput,
} from "@/lib/schemas/application";
import type { ApplicationStatus, JobApplication } from "@/types";

export type FormState = {
  id?: string;
  url: string;
  linkedinUrl: string;
  title: string;
  company: string;
  appliedAt: string;
  viaRecruiter: boolean;
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
    viaRecruiter: false,
    recruiterName: "",
    recruiterFirm: "",
    contactEmail: "",
    contactPhone: "",
    fullJd: "",
    status: "applied",
  };
}

export function isFormValid(form: FormState): boolean {
  return requiredApplicationFieldsSchema.safeParse({
    url: form.url,
    title: form.title,
    company: form.company,
    appliedAt: form.appliedAt,
  }).success;
}

export function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formToInput(form: FormState): ParsedCreateJobApplicationInput {
  const hasRecruiterInfo = (form.recruiterName?.trim().length ?? 0) > 0 || (form.recruiterFirm?.trim().length ?? 0) > 0;
  const result = createJobApplicationSchema.safeParse({
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
    fullJd: form.fullJd,
    status: form.status,
  });

  if (!result.success) {
    throw new Error(formatZodError(result.error));
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
    viaRecruiter: application.viaRecruiter,
    recruiterName: application.recruiterName ?? "",
    recruiterFirm: application.recruiterFirm ?? "",
    contactEmail: application.contactEmail ?? "",
    contactPhone: application.contactPhone ?? "",
    fullJd: application.fullJd ?? "",
    status: application.status,
  };
}
