import type Database from "better-sqlite3";
import { normalizeJobTitle } from "@/lib/normalizeJobTitle";
import type { JobApplication, ParsedCreateJobApplicationInput } from "@/types";
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
    title: normalizeJobTitle(row.title),
    company: row.company,
    appliedAt: row.applied_at,
    viaRecruiter: row.via_recruiter === 1,
    recruiterName: row.recruiter_name,
    recruiterFirm: row.recruiter_firm,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
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

const LIST_SQL = `SELECT
  id, url, linkedin_url, title, company, applied_at,
  via_recruiter, recruiter_name, recruiter_firm,
  contact_email, contact_phone, full_jd, status, created_at, updated_at
FROM applications ORDER BY updated_at DESC, created_at DESC`;
const GET_BY_ID_SQL = `SELECT
  id, url, linkedin_url, title, company, applied_at,
  via_recruiter, recruiter_name, recruiter_firm,
  contact_email, contact_phone, full_jd, status, created_at, updated_at
FROM applications WHERE id = ?`;
const INSERT_SQL = `INSERT INTO applications (
  id, url, linkedin_url, title, company, applied_at,
  via_recruiter, recruiter_name, recruiter_firm,
  contact_email, contact_phone, full_jd, status,
  created_at, updated_at
) VALUES (
  $id, $url, $linkedin_url, $title, $company, $applied_at,
  $via_recruiter, $recruiter_name, $recruiter_firm,
  $contact_email, $contact_phone, $full_jd, $status,
  $created_at, $updated_at
)`;
const UPDATE_SQL = `UPDATE applications SET
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
  full_jd = $full_jd,
  status = $status,
  updated_at = $updated_at
WHERE id = $id`;
const DELETE_SQL = `DELETE FROM applications WHERE id = ?`;

export class SqliteJobApplicationRepository implements JobApplicationRepository {
  private readonly db;
  private readonly listStmt;
  private readonly getByIdStmt;
  private readonly insertStmt;
  private readonly updateStmt;
  private readonly deleteStmt;

  constructor(db: Database.Database) {
    this.db = db;
    this.listStmt = db.prepare(LIST_SQL);
    this.getByIdStmt = db.prepare(GET_BY_ID_SQL);
    this.insertStmt = db.prepare(INSERT_SQL);
    this.updateStmt = db.prepare(UPDATE_SQL);
    this.deleteStmt = db.prepare(DELETE_SQL);
  }

  async list(): Promise<JobApplication[]> {
    const rows = this.listStmt.all() as ApplicationRow[];
    return rows.map(rowToApplication);
  }

  async listByIds(ids: string[]): Promise<JobApplication[]> {
    if (ids.length === 0) {
      return this.list();
    }

    const uniqueIds = [...new Set(ids)];
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const sql = `${LIST_SQL.replace("FROM applications", `FROM applications WHERE id IN (${placeholders})`)}`;
    const rows = this.db.prepare(sql).all(...uniqueIds) as ApplicationRow[];
    const applicationsById = new Map(rows.map((row) => [row.id, rowToApplication(row)]));
    return uniqueIds.flatMap((id) => {
      const application = applicationsById.get(id);
      return application ? [application] : [];
    });
  }

  async getById(id: string): Promise<JobApplication | null> {
    const row = this.getByIdStmt.get(id) as ApplicationRow | undefined;
    return row ? rowToApplication(row) : null;
  }

  async create(input: ParsedCreateJobApplicationInput): Promise<JobApplication> {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const viaRecruiter = input.viaRecruiter ?? false;

    this.insertStmt.run({
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
      full_jd: trimOrNull(input.fullJd),
      status: input.status ?? "applied",
      created_at: timestamp,
      updated_at: timestamp,
    });

    const row = this.getByIdStmt.get(id) as ApplicationRow | undefined;

    if (!row) {
      throw new Error("Failed to create application");
    }

    return rowToApplication(row);
  }

  async update(id: string, input: Partial<ParsedCreateJobApplicationInput>): Promise<JobApplication | null> {
    const existing = this.getByIdStmt.get(id) as ApplicationRow | undefined;

    if (!existing) {
      return null;
    }

    const viaRecruiter = input.viaRecruiter !== undefined ? input.viaRecruiter : existing.via_recruiter === 1;

    const updated: ApplicationRow = {
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
      full_jd: input.fullJd !== undefined ? trimOrNull(input.fullJd) : existing.full_jd,
      status: input.status ?? existing.status,
      updated_at: nowIso(),
    };

    this.updateStmt.run({
      id,
      url: updated.url,
      linkedin_url: updated.linkedin_url,
      title: updated.title,
      company: updated.company,
      applied_at: updated.applied_at,
      via_recruiter: updated.via_recruiter,
      recruiter_name: updated.recruiter_name,
      recruiter_firm: updated.recruiter_firm,
      contact_email: updated.contact_email,
      contact_phone: updated.contact_phone,
      full_jd: updated.full_jd,
      status: updated.status,
      updated_at: updated.updated_at,
    });

    return rowToApplication(updated);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.deleteStmt.run(id);
    return result.changes > 0;
  }
}
