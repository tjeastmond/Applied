import type { Database } from "bun:sqlite";
import type { CreateJobApplicationInput, JobApplication } from "../../src/types";
import type { JobApplicationRepository } from "../repositories/jobApplicationRepository";

type ApplicationRow = {
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
  notes: string | null;
  full_jd: string | null;
  status: JobApplication["status"];
  created_at: string;
  updated_at: string;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function rowToApplication(row: ApplicationRow): JobApplication {
  return {
    id: row.id,
    url: row.url,
    linkedinUrl: row.linkedin_url,
    title: row.title,
    company: row.company,
    appliedAt: row.applied_at,
    viaRecruiter: row.via_recruiter === 1,
    recruiterName: row.recruiter_name,
    recruiterFirm: row.recruiter_firm,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    notes: row.notes,
    fullJd: row.full_jd,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SqliteJobApplicationRepository implements JobApplicationRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<JobApplication[]> {
    const rows = this.db
      .query<
        ApplicationRow,
        []
      >(`SELECT * FROM applications ORDER BY applied_at DESC, created_at DESC`)
      .all();
    return rows.map(rowToApplication);
  }

  async create(input: CreateJobApplicationInput): Promise<JobApplication> {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const viaRecruiter = input.viaRecruiter ?? false;

    this.db
      .query(
        `INSERT INTO applications (
          id, url, linkedin_url, title, company, applied_at,
          via_recruiter, recruiter_name, recruiter_firm,
          contact_email, contact_phone, notes, full_jd, status,
          created_at, updated_at
        ) VALUES (
          $id, $url, $linkedin_url, $title, $company, $applied_at,
          $via_recruiter, $recruiter_name, $recruiter_firm,
          $contact_email, $contact_phone, $notes, $full_jd, $status,
          $created_at, $updated_at
        )`,
      )
      .run({
        $id: id,
        $url: input.url.trim(),
        $linkedin_url: trimOrNull(input.linkedinUrl),
        $title: input.title?.trim() ?? "",
        $company: input.company?.trim() ?? "",
        $applied_at: input.appliedAt?.trim() ?? todayIsoDate(),
        $via_recruiter: viaRecruiter ? 1 : 0,
        $recruiter_name: viaRecruiter ? trimOrNull(input.recruiterName) : null,
        $recruiter_firm: viaRecruiter ? trimOrNull(input.recruiterFirm) : null,
        $contact_email: trimOrNull(input.contactEmail),
        $contact_phone: trimOrNull(input.contactPhone),
        $notes: trimOrNull(input.notes),
        $full_jd: trimOrNull(input.fullJd),
        $status: input.status ?? "applied",
        $created_at: timestamp,
        $updated_at: timestamp,
      });

    const row = this.db
      .query<ApplicationRow, [string]>(`SELECT * FROM applications WHERE id = ?`)
      .get(id);

    if (!row) {
      throw new Error("Failed to create application");
    }

    return rowToApplication(row);
  }

  async update(
    id: string,
    input: Partial<CreateJobApplicationInput>,
  ): Promise<JobApplication | null> {
    const existing = this.db
      .query<ApplicationRow, [string]>(`SELECT * FROM applications WHERE id = ?`)
      .get(id);

    if (!existing) {
      return null;
    }

    const viaRecruiter =
      input.viaRecruiter !== undefined ? input.viaRecruiter : existing.via_recruiter === 1;

    const updated: ApplicationRow = {
      ...existing,
      url: input.url !== undefined ? input.url.trim() : existing.url,
      linkedin_url:
        input.linkedinUrl !== undefined ? trimOrNull(input.linkedinUrl) : existing.linkedin_url,
      title: input.title !== undefined ? trimOrNull(input.title) : existing.title,
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
      contact_email:
        input.contactEmail !== undefined ? trimOrNull(input.contactEmail) : existing.contact_email,
      contact_phone:
        input.contactPhone !== undefined ? trimOrNull(input.contactPhone) : existing.contact_phone,
      notes: input.notes !== undefined ? trimOrNull(input.notes) : existing.notes,
      full_jd: input.fullJd !== undefined ? trimOrNull(input.fullJd) : existing.full_jd,
      status: input.status ?? existing.status,
      updated_at: nowIso(),
    };

    this.db
      .query(
        `UPDATE applications SET
          url = $url,
          linkedin_url = $linkedin_url,
          title = $title,
          company = $company,
          applied_at = $applied_at,
          via_recruiter = $via_recruiter,
          recruiter_name = $recruiter_name,
          recruiter_firm = $recruiter_firm,
          contact_email = $contact_email,
          contact_phone = $contact_phone,
          notes = $notes,
          full_jd = $full_jd,
          status = $status,
          updated_at = $updated_at
        WHERE id = $id`,
      )
      .run({
        $id: id,
        $url: updated.url,
        $linkedin_url: updated.linkedin_url,
        $title: updated.title,
        $company: updated.company,
        $applied_at: updated.applied_at,
        $via_recruiter: updated.via_recruiter,
        $recruiter_name: updated.recruiter_name,
        $recruiter_firm: updated.recruiter_firm,
        $contact_email: updated.contact_email,
        $contact_phone: updated.contact_phone,
        $notes: updated.notes,
        $full_jd: updated.full_jd,
        $status: updated.status,
        $updated_at: updated.updated_at,
      });

    return rowToApplication(updated);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.query(`DELETE FROM applications WHERE id = ?`).run(id);
    return result.changes > 0;
  }
}
