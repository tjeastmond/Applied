import type Database from "better-sqlite3";
import { BACKUP_JSON_VERSION, backupJsonSchema, type BackupJson, type ImportMode } from "@/lib/schemas/backup";
import type { ApplicationNote, JobApplication } from "@/types";
import type { NoteRow } from "../db/applicationNoteRepositoryShared";
import { LIST_APPLICATIONS_SQL, type ApplicationRow } from "../db/applicationRepositoryShared";
import { readBackupSchemaSql } from "../db/schema";

export type ImportResult = {
  applications: JobApplication[];
  imported: {
    applications: number;
    notes: number;
  };
};

export type ApplicationBackupRow = ApplicationRow & {
  notes: string | null;
};

export const UPSERT_APPLICATION_SQL = `INSERT INTO applications (
  id, url, linkedin_url, title, company, applied_at, via_recruiter, recruiter_name, recruiter_firm,
  contact_email, contact_phone, salary_range, desired_salary, notes, full_jd, status, created_at, updated_at
) VALUES (
  @id, @url, @linkedin_url, @title, @company, @applied_at, @via_recruiter, @recruiter_name, @recruiter_firm,
  @contact_email, @contact_phone, @salary_range, @desired_salary, @notes, @full_jd, @status, @created_at, @updated_at
) ON CONFLICT(id) DO UPDATE SET
  url = excluded.url,
  linkedin_url = excluded.linkedin_url,
  title = excluded.title,
  company = excluded.company,
  applied_at = excluded.applied_at,
  via_recruiter = excluded.via_recruiter,
  recruiter_name = excluded.recruiter_name,
  recruiter_firm = excluded.recruiter_firm,
  contact_email = excluded.contact_email,
  contact_phone = excluded.contact_phone,
  salary_range = excluded.salary_range,
  desired_salary = excluded.desired_salary,
  notes = excluded.notes,
  full_jd = excluded.full_jd,
  status = excluded.status,
  updated_at = excluded.updated_at`;

export const UPSERT_NOTE_SQL = `INSERT INTO application_notes (id, application_id, content, created_at)
VALUES (@id, @application_id, @content, @created_at)
ON CONFLICT(id) DO UPDATE SET
  application_id = excluded.application_id,
  content = excluded.content`;

export function rowToBackupApplication(row: ApplicationBackupRow): JobApplication {
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
    salaryRange: row.salary_range,
    desiredSalary: row.desired_salary,
    fullJd: row.full_jd,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToBackupNote(row: NoteRow): ApplicationNote {
  return {
    id: row.id,
    applicationId: row.application_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function applicationToRow(application: BackupJson["applications"][number]): ApplicationBackupRow {
  return {
    id: application.id,
    url: application.url,
    linkedin_url: application.linkedinUrl,
    title: application.title,
    company: application.company,
    applied_at: application.appliedAt,
    via_recruiter: application.viaRecruiter ? 1 : 0,
    recruiter_name: application.recruiterName,
    recruiter_firm: application.recruiterFirm,
    contact_email: application.contactEmail,
    contact_phone: application.contactPhone,
    salary_range: application.salaryRange ?? null,
    desired_salary: application.desiredSalary ?? null,
    notes: null,
    full_jd: application.fullJd,
    status: application.status,
    created_at: application.createdAt,
    updated_at: application.updatedAt,
  };
}

export function noteToRow(note: BackupJson["notes"][number]): NoteRow {
  return {
    id: note.id,
    application_id: note.applicationId,
    content: note.content,
    created_at: note.createdAt,
  };
}

function sqlQuote(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function listApplications(db: Database.Database): JobApplication[] {
  const rows = db.prepare(LIST_APPLICATIONS_SQL).all() as ApplicationBackupRow[];
  return rows.map(rowToBackupApplication);
}

function listNotes(db: Database.Database): ApplicationNote[] {
  const rows = db
    .prepare(`SELECT id, application_id, content, created_at FROM application_notes ORDER BY created_at ASC, rowid ASC`)
    .all() as NoteRow[];
  return rows.map(rowToBackupNote);
}

export function createBackupJson(applications: JobApplication[], notes: ApplicationNote[]): BackupJson {
  return {
    version: BACKUP_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    applications,
    notes,
  };
}

export function parseBackupJson(raw: unknown): BackupJson {
  const parsed = backupJsonSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid backup JSON format");
  }

  return parsed.data;
}

export function exportJson(db: Database.Database): BackupJson {
  return createBackupJson(listApplications(db), listNotes(db));
}

function applicationToSqlRow(application: JobApplication): ApplicationBackupRow {
  return applicationToRow({
    id: application.id,
    url: application.url,
    linkedinUrl: application.linkedinUrl,
    title: application.title,
    company: application.company,
    appliedAt: application.appliedAt,
    viaRecruiter: application.viaRecruiter,
    recruiterName: application.recruiterName,
    recruiterFirm: application.recruiterFirm,
    contactEmail: application.contactEmail,
    contactPhone: application.contactPhone,
    salaryRange: application.salaryRange,
    desiredSalary: application.desiredSalary,
    fullJd: application.fullJd,
    status: application.status,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  });
}

export function exportSqlFromRecords(applications: JobApplication[], notes: ApplicationNote[]): string {
  const exportedAt = new Date().toISOString();
  const lines: string[] = [
    "-- Applied.dev database backup",
    `-- Exported: ${exportedAt}`,
    "",
    "PRAGMA foreign_keys = OFF;",
    "BEGIN TRANSACTION;",
    "",
    "DROP TABLE IF EXISTS application_notes;",
    "DROP TABLE IF EXISTS applications;",
    "",
    readBackupSchemaSql().trim(),
    "",
  ];

  for (const row of applications.map(applicationToSqlRow)) {
    lines.push(
      `INSERT INTO applications (id, url, linkedin_url, title, company, applied_at, via_recruiter, recruiter_name, recruiter_firm, contact_email, contact_phone, salary_range, desired_salary, notes, full_jd, status, created_at, updated_at) VALUES (${[
        sqlQuote(row.id),
        sqlQuote(row.url),
        sqlQuote(row.linkedin_url),
        sqlQuote(row.title),
        sqlQuote(row.company),
        sqlQuote(row.applied_at),
        String(row.via_recruiter),
        sqlQuote(row.recruiter_name),
        sqlQuote(row.recruiter_firm),
        sqlQuote(row.contact_email),
        sqlQuote(row.contact_phone),
        sqlQuote(row.salary_range),
        sqlQuote(row.desired_salary),
        sqlQuote(row.notes),
        sqlQuote(row.full_jd),
        sqlQuote(row.status),
        sqlQuote(row.created_at),
        sqlQuote(row.updated_at),
      ].join(", ")});`,
    );
  }

  for (const row of notes.map(noteToRow)) {
    lines.push(
      `INSERT INTO application_notes (id, application_id, content, created_at) VALUES (${[
        sqlQuote(row.id),
        sqlQuote(row.application_id),
        sqlQuote(row.content),
        sqlQuote(row.created_at),
      ].join(", ")});`,
    );
  }

  lines.push("", "COMMIT;", "PRAGMA foreign_keys = ON;", "");
  return lines.join("\n");
}

export function exportSql(db: Database.Database): string {
  return exportSqlFromRecords(listApplications(db), listNotes(db));
}

function clearAllData(db: Database.Database): void {
  db.exec(`DELETE FROM application_notes; DELETE FROM applications;`);
}

function importJsonData(db: Database.Database, data: BackupJson, mode: ImportMode): ImportResult {
  const upsertApplication = db.prepare(UPSERT_APPLICATION_SQL);
  const upsertNote = db.prepare(UPSERT_NOTE_SQL);

  const run = db.transaction(() => {
    if (mode === "replace") {
      clearAllData(db);
    }

    for (const application of data.applications) {
      upsertApplication.run(applicationToRow(application));
    }

    for (const note of data.notes) {
      upsertNote.run(noteToRow(note));
    }
  });

  run();

  return {
    applications: listApplications(db),
    imported: {
      applications: data.applications.length,
      notes: data.notes.length,
    },
  };
}

export function importJson(db: Database.Database, raw: unknown, mode: ImportMode): ImportResult {
  return importJsonData(db, parseBackupJson(raw), mode);
}

export function extractInsertStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => /^INSERT\s+INTO\s+/i.test(statement));
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function stripSqlComments(statement: string): string {
  return statement
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

function isAllowedSqlBackupStatement(statement: string): boolean {
  const withoutComments = stripSqlComments(statement);
  if (withoutComments.length === 0) {
    return true;
  }

  const normalized = withoutComments.replace(/\s+/g, " ").trim();

  if (/^PRAGMA\s+foreign_keys\s*=\s*(ON|OFF)$/i.test(normalized)) {
    return true;
  }

  if (/^BEGIN(?:\s+TRANSACTION)?$/i.test(normalized)) {
    return true;
  }

  if (/^COMMIT$/i.test(normalized)) {
    return true;
  }

  if (/^DROP TABLE IF EXISTS (?:applications|application_notes)$/i.test(normalized)) {
    return true;
  }

  if (/^CREATE TABLE IF NOT EXISTS applications\s*\(/i.test(normalized)) {
    return true;
  }

  if (/^CREATE TABLE IF NOT EXISTS application_notes\s*\(/i.test(normalized)) {
    return true;
  }

  if (/^CREATE INDEX IF NOT EXISTS idx_/i.test(normalized)) {
    return true;
  }

  if (/^INSERT\s+INTO\s+(?:applications|application_notes)\b/i.test(normalized)) {
    return true;
  }

  return false;
}

export function assertSqlBackupIsSafe(sql: string): void {
  const forbiddenPattern = /\b(?:ATTACH|DETACH|ALTER)\b/i;
  if (forbiddenPattern.test(sql)) {
    throw new Error("SQL backup contains forbidden statements");
  }

  for (const statement of splitSqlStatements(sql)) {
    if (forbiddenPattern.test(statement)) {
      throw new Error("SQL backup contains forbidden statements");
    }

    if (
      /^PRAGMA\b/i.test(statement) &&
      !/^PRAGMA\s+foreign_keys\s*=\s*(?:ON|OFF)\s*$/i.test(statement.replace(/\s+/g, " ").trim())
    ) {
      throw new Error("SQL backup contains forbidden PRAGMA statements");
    }

    if (!isAllowedSqlBackupStatement(statement)) {
      throw new Error("SQL backup contains unsupported statements");
    }
  }
}

export function countSqlInserts(sql: string): { applications: number; notes: number } {
  const inserts = extractInsertStatements(sql);
  let applications = 0;
  let notes = 0;

  for (const insert of inserts) {
    if (/INSERT\s+INTO\s+applications\b/i.test(insert)) {
      applications += 1;
    } else if (/INSERT\s+INTO\s+application_notes\b/i.test(insert)) {
      notes += 1;
    }
  }

  return { applications, notes };
}

export function prepareSqlUpsertStatements(sql: string): string[] {
  const inserts = extractInsertStatements(sql);
  if (inserts.length === 0) {
    throw new Error("No INSERT statements found in SQL backup");
  }

  return inserts.map((insert) => `${insert.replace(/^INSERT\s+INTO/i, "INSERT OR REPLACE INTO")};`);
}

function importSqlStatements(db: Database.Database, sql: string, mode: ImportMode): ImportResult {
  assertSqlBackupIsSafe(sql);
  const upserts = prepareSqlUpsertStatements(sql);
  const imported = countSqlInserts(sql);

  const run = db.transaction(() => {
    if (mode === "replace") {
      clearAllData(db);
    }

    for (const upsert of upserts) {
      db.exec(upsert);
    }
  });

  run();

  return {
    applications: listApplications(db),
    imported,
  };
}

function importSqlUpsert(db: Database.Database, sql: string): ImportResult {
  return importSqlStatements(db, sql, "upsert");
}

export function importSql(db: Database.Database, sql: string, mode: ImportMode): ImportResult {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    throw new Error("SQL backup is empty");
  }

  if (mode === "upsert") {
    return importSqlUpsert(db, trimmed);
  }

  return importSqlStatements(db, trimmed, "replace");
}

export function backupFilename(format: "sql" | "json", exportedAt = new Date()): string {
  const stamp = exportedAt.toISOString().replace(/[:.]/g, "-");
  return `applied-backup-${stamp}.${format}`;
}
