import type { JobApplication } from "@/types";

export function makeJobApplication(overrides: Partial<JobApplication> & Pick<JobApplication, "id">): JobApplication {
  return {
    id: overrides.id,
    url: overrides.url ?? `https://example.com/${overrides.id}`,
    linkedinUrl: overrides.linkedinUrl ?? null,
    title: overrides.title ?? overrides.id,
    company: overrides.company ?? "Acme",
    appliedAt: overrides.appliedAt ?? "2026-06-01",
    viaRecruiter: overrides.viaRecruiter ?? false,
    recruiterName: overrides.recruiterName ?? null,
    recruiterFirm: overrides.recruiterFirm ?? null,
    contactEmail: overrides.contactEmail ?? null,
    contactPhone: overrides.contactPhone ?? null,
    salaryRange: overrides.salaryRange ?? null,
    desiredSalary: overrides.desiredSalary ?? null,
    fullJd: overrides.fullJd ?? null,
    status: overrides.status ?? "applied",
    archived: overrides.archived ?? false,
    pinned: overrides.pinned ?? false,
    createdAt: overrides.createdAt ?? "2026-06-01T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-01T10:00:00.000Z",
  };
}
