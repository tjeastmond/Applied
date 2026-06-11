import { normalizeJobTitle } from "@/lib/normalizeJobTitle";
import type { JobApplication, ParsedCreateJobApplicationInput } from "@/types";

export type ApplicationRow = {
  id: string;
  url: string;
  linkedin_url: string | null;
  title: string | null;
  company: string | null;
  applied_at: string;
  via_recruiter: number;
  recruiter_name: string | null;
  recruiter_firm: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  salary_range: string | null;
  desired_salary: string | null;
  full_jd: string | null;
  status: JobApplication["status"];
  created_at: string;
  updated_at: string;
};

export const LIST_APPLICATIONS_SQL = `SELECT
  id, url, linkedin_url, title, company, applied_at,
  via_recruiter, recruiter_name, recruiter_firm,
  contact_email, contact_phone, salary_range, desired_salary, full_jd, status, created_at, updated_at
FROM applications ORDER BY updated_at DESC, created_at DESC`;

export const GET_APPLICATION_BY_ID_SQL = `SELECT
  id, url, linkedin_url, title, company, applied_at,
  via_recruiter, recruiter_name, recruiter_firm,
  contact_email, contact_phone, salary_range, desired_salary, full_jd, status, created_at, updated_at
FROM applications WHERE id = ?`;

export const INSERT_APPLICATION_SQL = `INSERT INTO applications (
  id, url, linkedin_url, title, company, applied_at,
  via_recruiter, recruiter_name, recruiter_firm,
  contact_email, contact_phone, salary_range, desired_salary, full_jd, status,
  created_at, updated_at
) VALUES (
  @id, @url, @linkedin_url, @title, @company, @applied_at,
  @via_recruiter, @recruiter_name, @recruiter_firm,
  @contact_email, @contact_phone, @salary_range, @desired_salary, @full_jd, @status,
  @created_at, @updated_at
)`;

export const UPDATE_APPLICATION_SQL = `UPDATE applications SET
  url = @url,
  linkedin_url = @linkedin_url,
  title = @title,
  company = @company,
  applied_at = @applied_at,
  via_recruiter = @via_recruiter,
  recruiter_name = @recruiter_name,
  recruiter_firm = @recruiter_firm,
  contact_email = @contact_email,
  contact_phone = @contact_phone,
  salary_range = @salary_range,
  desired_salary = @desired_salary,
  full_jd = @full_jd,
  status = @status,
  updated_at = @updated_at
WHERE id = @id`;

export const DELETE_APPLICATION_SQL = `DELETE FROM applications WHERE id = ?`;

export function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function rowToApplication(row: ApplicationRow): JobApplication {
  return {
    id: row.id,
    url: row.url,
    linkedinUrl: row.linkedin_url,
    title: normalizeJobTitle(row.title),
    company: row.company,
    appliedAt: row.applied_at,
    viaRecruiter: row.via_recruiter === 1,
    recruiterName: row.recruiter_name,
    recruiterFirm: row.recruiter_firm,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    salaryRange: row.salary_range,
    desiredSalary: row.desired_salary,
    fullJd: row.full_jd,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildApplicationInsertRow(
  input: ParsedCreateJobApplicationInput,
  id = crypto.randomUUID(),
  timestamp = nowIso(),
): ApplicationRow {
  const viaRecruiter = input.viaRecruiter ?? false;

  return {
    id,
    url: input.url.trim(),
    linkedin_url: trimOrNull(input.linkedinUrl),
    title: normalizeJobTitle(input.title?.trim()) ?? "",
    company: input.company?.trim() ?? "",
    applied_at: input.appliedAt?.trim() ?? todayIsoDate(),
    via_recruiter: viaRecruiter ? 1 : 0,
    recruiter_name: viaRecruiter ? trimOrNull(input.recruiterName) : null,
    recruiter_firm: viaRecruiter ? trimOrNull(input.recruiterFirm) : null,
    contact_email: trimOrNull(input.contactEmail),
    contact_phone: trimOrNull(input.contactPhone),
    salary_range: trimOrNull(input.salaryRange),
    desired_salary: trimOrNull(input.desiredSalary),
    full_jd: trimOrNull(input.fullJd),
    status: input.status ?? "applied",
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function buildApplicationUpdateRow(
  existing: ApplicationRow,
  input: Partial<ParsedCreateJobApplicationInput>,
  timestamp = nowIso(),
): ApplicationRow {
  const viaRecruiter = input.viaRecruiter !== undefined ? input.viaRecruiter : existing.via_recruiter === 1;

  return {
    ...existing,
    url: input.url !== undefined ? input.url.trim() : existing.url,
    linkedin_url: input.linkedinUrl !== undefined ? trimOrNull(input.linkedinUrl) : existing.linkedin_url,
    title: input.title !== undefined ? normalizeJobTitle(trimOrNull(input.title)) : existing.title,
    company: input.company !== undefined ? trimOrNull(input.company) : existing.company,
    applied_at: input.appliedAt ?? existing.applied_at,
    via_recruiter: viaRecruiter ? 1 : 0,
    recruiter_name: viaRecruiter
      ? input.recruiterName !== undefined
        ? trimOrNull(input.recruiterName)
        : existing.recruiter_name
      : null,
    recruiter_firm: viaRecruiter
      ? input.recruiterFirm !== undefined
        ? trimOrNull(input.recruiterFirm)
        : existing.recruiter_firm
      : null,
    contact_email: input.contactEmail !== undefined ? trimOrNull(input.contactEmail) : existing.contact_email,
    contact_phone: input.contactPhone !== undefined ? trimOrNull(input.contactPhone) : existing.contact_phone,
    salary_range: input.salaryRange !== undefined ? trimOrNull(input.salaryRange) : existing.salary_range,
    desired_salary: input.desiredSalary !== undefined ? trimOrNull(input.desiredSalary) : existing.desired_salary,
    full_jd: input.fullJd !== undefined ? trimOrNull(input.fullJd) : existing.full_jd,
    status: input.status ?? existing.status,
    updated_at: timestamp,
  };
}
