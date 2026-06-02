import type { CreateJobApplicationInput, JobApplication } from "@/types";

export type FormState = CreateJobApplicationInput & { id?: string };

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
  return (
    form.url.trim().length > 0 &&
    (form.title?.trim().length ?? 0) > 0 &&
    (form.company?.trim().length ?? 0) > 0 &&
    (form.appliedAt?.trim().length ?? 0) > 0
  );
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

export function formToInput(form: FormState): CreateJobApplicationInput {
  const hasRecruiterInfo =
    (form.recruiterName?.trim().length ?? 0) > 0 || (form.recruiterFirm?.trim().length ?? 0) > 0;

  return {
    url: form.url.trim(),
    linkedinUrl: form.linkedinUrl?.trim() || null,
    title: form.title?.trim() ?? "",
    company: form.company?.trim() ?? "",
    appliedAt: form.appliedAt?.trim() ?? today(),
    viaRecruiter: hasRecruiterInfo,
    recruiterName: hasRecruiterInfo ? form.recruiterName?.trim() || null : null,
    recruiterFirm: hasRecruiterInfo ? form.recruiterFirm?.trim() || null : null,
    contactEmail: form.contactEmail?.trim() || null,
    contactPhone: form.contactPhone?.trim() || null,
    fullJd: form.fullJd?.trim() || null,
    status: form.status ?? "applied",
  };
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
