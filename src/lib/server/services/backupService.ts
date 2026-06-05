import type Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BACKUP_JSON_VERSION, backupJsonSchema, type BackupJson, type ImportMode } from "@/lib/schemas/backup";
import type { ApplicationNote, JobApplication } from "@/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL = readFileSync(join(__dirname, "../db/schema.sql"), "utf-8");

export type ImportResult = {
  applications: JobApplication[];
  imported: {
    applications: number;
    notes: number;
  };
};

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

type NoteRow = {
  id: string;
  application_id: string;
  content: string;
  created_at: string;
};

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
    fullJd: row.full_jd,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToNote(row: NoteRow): ApplicationNote {
  return {
    id: row.id,
    applicationId: row.application_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

function sqlQuote(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function listApplications(db: Database.Database): JobApplication[] {
  const rows = db
    .prepare(
      `SELECT id, url, linkedin_url, title, company, applied_at, via_recruiter, recruiter_name, recruiter_firm,
       contact_email, contact_phone, full_jd, status, created_at, updated_at
       FROM applications ORDER BY updated_at DESC, created_at DESC`,
    )
    .all() as ApplicationRow[];
  return rows.map(rowToApplication);
}

function listNotes(db: Database.Database): ApplicationNote[] {
  const rows = db
    .prepare(`SELECT id, application_id, content, created_at FROM application_notes ORDER BY created_at ASC, rowid ASC`)
    .all() as NoteRow[];
  return rows.map(rowToNote);
}

export function exportJson(db: Database.Database): BackupJson {
  return {
    version: BACKUP_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    applications: listApplications(db),
    notes: listNotes(db),
  };
}

export function exportSql(db: Database.Database): string {
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
    SCHEMA_SQL.trim(),
    "",
  ];

  const applicationRows = db
    .prepare(
      `SELECT id, url, linkedin_url, title, company, applied_at, via_recruiter, recruiter_name, recruiter_firm,
       contact_email, contact_phone, notes, full_jd, status, created_at, updated_at FROM applications`,
    )
    .all() as ApplicationRow[];

  for (const row of applicationRows) {
    lines.push(
      `INSERT INTO applications (id, url, linkedin_url, title, company, applied_at, via_recruiter, recruiter_name, recruiter_firm, contact_email, contact_phone, notes, full_jd, status, created_at, updated_at) VALUES (${[
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
        sqlQuote(row.notes),
        sqlQuote(row.full_jd),
        sqlQuote(row.status),
        sqlQuote(row.created_at),
        sqlQuote(row.updated_at),
      ].join(", ")});`,
    );
  }

  const noteRows = db
    .prepare(`SELECT id, application_id, content, created_at FROM application_notes`)
    .all() as NoteRow[];

  for (const row of noteRows) {
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

function clearAllData(db: Database.Database): void {
  db.exec(`DELETE FROM application_notes; DELETE FROM applications;`);
}

function applicationToRow(application: BackupJson["applications"][number]): ApplicationRow {
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
    notes: null,
    full_jd: application.fullJd,
    status: application.status,
    created_at: application.createdAt,
    updated_at: application.updatedAt,
  };
}

const UPSERT_APPLICATION_SQL = `INSERT INTO applications (
  id, url, linkedin_url, title, company, applied_at, via_recruiter, recruiter_name, recruiter_firm,
  contact_email, contact_phone, notes, full_jd, status, created_at, updated_at
) VALUES (
  @id, @url, @linkedin_url, @title, @company, @applied_at, @via_recruiter, @recruiter_name, @recruiter_firm,
  @contact_email, @contact_phone, @notes, @full_jd, @status, @created_at, @updated_at
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
  notes = excluded.notes,
  full_jd = excluded.full_jd,
  status = excluded.status,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at`;

const UPSERT_NOTE_SQL = `INSERT INTO application_notes (id, application_id, content, created_at)
VALUES (@id, @application_id, @content, @created_at)
ON CONFLICT(id) DO UPDATE SET
  application_id = excluded.application_id,
  content = excluded.content,
  created_at = excluded.created_at`;

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
      upsertNote.run({
        id: note.id,
        application_id: note.applicationId,
        content: note.content,
        created_at: note.createdAt,
      });
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
  const parsed = backupJsonSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid backup JSON format");
  }

  return importJsonData(db, parsed.data, mode);
}

function extractInsertStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => /^INSERT\s+INTO\s+/i.test(statement));
}

function countSqlInserts(sql: string): { applications: number; notes: number } {
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

function importSqlUpsert(db: Database.Database, sql: string): ImportResult {
  const inserts = extractInsertStatements(sql);
  if (inserts.length === 0) {
    throw new Error("No INSERT statements found in SQL backup");
  }

  const imported = countSqlInserts(sql);

  const run = db.transaction(() => {
    for (const insert of inserts) {
      const upsert = insert.replace(/^INSERT\s+INTO/i, "INSERT OR REPLACE INTO");
      db.exec(`${upsert};`);
    }
  });

  run();

  return {
    applications: listApplications(db),
    imported,
  };
}

export function importSql(db: Database.Database, sql: string, mode: ImportMode): ImportResult {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    throw new Error("SQL backup is empty");
  }

  if (mode === "upsert") {
    return importSqlUpsert(db, trimmed);
  }

  const imported = countSqlInserts(trimmed);
  db.exec(trimmed);

  return {
    applications: listApplications(db),
    imported,
  };
}

export function backupFilename(format: "sql" | "json", exportedAt = new Date()): string {
  const stamp = exportedAt.toISOString().replace(/[:.]/g, "-");
  return `applied-backup-${stamp}.${format}`;
}
