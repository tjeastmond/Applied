import type Database from "better-sqlite3";
import { BACKUP_JSON_VERSION, backupJsonSchema, type BackupJson, type ImportMode } from "@/lib/schemas/backup";
import type { ApplicationNote, JobApplication } from "@/types";
import type { NoteRow } from "../db/applicationNoteRepositoryShared";
import {
  LIST_APPLICATIONS_SQL,
  jobApplicationToApplicationRow,
  rowToApplication,
  type ApplicationRow,
} from "../db/applicationRepositoryShared";
import { backfillCompaniesFromApplications, backfillMissingStatusHistory } from "../db/migrate";
import { sanitizeStoredHtml } from "./extractFullJd";
import { readBackupSchemaSql } from "../db/schema";
import type { CompanyRow } from "../db/companyRepositoryShared";
import type { UserRow } from "../db/userRepositoryShared";

import {
  UPSERT_APPLICATION_SQL,
  UPSERT_COMPANY_SQL,
  UPSERT_CONFLICT_CLAUSES,
  UPSERT_NOTE_SQL,
  UPSERT_STATUS_HISTORY_SQL,
  UPSERT_USER_SQL,
} from "./backupSql";
export {
  UPSERT_APPLICATION_SQL,
  UPSERT_COMPANY_SQL,
  UPSERT_NOTE_SQL,
  UPSERT_STATUS_HISTORY_SQL,
  UPSERT_USER_SQL,
} from "./backupSql";

export type ImportResult = {
  applications: JobApplication[];
  imported: {
    applications: number;
    notes: number;
    users: number;
    statusHistory: number;
    companies: number;
  };
};

export type ApplicationBackupRow = ApplicationRow & {
  notes: string | null;
};

export type StatusHistoryBackupRow = {
  id: string;
  application_id: string;
  user_id: string;
  from_status: JobApplication["status"] | null;
  to_status: JobApplication["status"];
  changed_at: string;
};

export function rowToBackupApplication(row: ApplicationBackupRow): JobApplication {
  return rowToApplication(row);
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
  const { full_jd, status, archived, pinned, created_at, updated_at, ...fields } = jobApplicationToApplicationRow({
    ...application,
    salaryRange: application.salaryRange ?? null,
    desiredSalary: application.desiredSalary ?? null,
    pinned: application.archived ? false : application.pinned,
  });
  // Keep parameter order aligned with UPSERT_APPLICATION_SQL for the Turso driver.
  return { ...fields, notes: null, full_jd, status, archived, pinned, created_at, updated_at };
}

export function noteToRow(note: BackupJson["notes"][number]): NoteRow {
  return {
    id: note.id,
    application_id: note.applicationId,
    content: note.content,
    created_at: note.createdAt,
  };
}

export function userToRow(user: BackupJson["users"][number]): UserRow {
  return {
    id: user.id,
    display_name: user.displayName,
    email: user.email,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

export function statusHistoryToRow(entry: BackupJson["statusHistory"][number]): StatusHistoryBackupRow {
  return {
    id: entry.id,
    application_id: entry.applicationId,
    user_id: entry.userId,
    from_status: entry.fromStatus,
    to_status: entry.toStatus,
    changed_at: entry.changedAt,
  };
}

export function companyToRow(company: BackupJson["companies"][number]): CompanyRow {
  return {
    id: company.id,
    name: company.name,
    url: company.url,
    linkedin_url: company.linkedinUrl,
    email: company.email,
    ignored: company.ignored ? 1 : 0,
    created_at: company.createdAt,
    updated_at: company.updatedAt,
  };
}

function rowToBackupUser(row: UserRow): BackupJson["users"][number] {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBackupStatusHistory(row: StatusHistoryBackupRow): BackupJson["statusHistory"][number] {
  return {
    id: row.id,
    applicationId: row.application_id,
    userId: row.user_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedAt: row.changed_at,
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

function listUsers(db: Database.Database): BackupJson["users"] {
  const rows = db
    .prepare(`SELECT id, display_name, email, created_at, updated_at FROM users ORDER BY created_at ASC, rowid ASC`)
    .all() as UserRow[];
  return rows.map(rowToBackupUser);
}

function listStatusHistory(db: Database.Database): BackupJson["statusHistory"] {
  const rows = db
    .prepare(
      `SELECT id, application_id, user_id, from_status, to_status, changed_at
       FROM application_status_history
       ORDER BY changed_at ASC, rowid ASC`,
    )
    .all() as StatusHistoryBackupRow[];
  return rows.map(rowToBackupStatusHistory);
}

function rowToBackupCompany(row: CompanyRow): BackupJson["companies"][number] {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    linkedinUrl: row.linkedin_url,
    email: row.email,
    ignored: row.ignored === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listCompanies(db: Database.Database): BackupJson["companies"] {
  const rows = db
    .prepare(
      `SELECT id, name, url, linkedin_url, email, ignored, created_at, updated_at FROM companies ORDER BY lower(trim(name)) ASC, created_at ASC`,
    )
    .all() as CompanyRow[];
  return rows.map(rowToBackupCompany);
}

export function createBackupJson(
  applications: JobApplication[],
  notes: ApplicationNote[],
  users: BackupJson["users"],
  statusHistory: BackupJson["statusHistory"],
  companies: BackupJson["companies"],
): BackupJson {
  return {
    version: BACKUP_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    applications: applications.map((application) => ({ ...application, fullJd: application.fullJd ?? null })),
    notes,
    users,
    statusHistory,
    companies,
  };
}

export function parseBackupJson(raw: unknown): BackupJson {
  const parsed = backupJsonSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid backup JSON format");
  }

  // Backups are untrusted input; fullJd is rendered as HTML, so sanitize like every other write.
  return {
    ...parsed.data,
    applications: parsed.data.applications.map((a) => ({
      ...a,
      fullJd: a.fullJd ? sanitizeStoredHtml(a.fullJd) : a.fullJd,
    })),
  };
}

export function exportJson(db: Database.Database): BackupJson {
  return createBackupJson(listApplications(db), listNotes(db), listUsers(db), listStatusHistory(db), listCompanies(db));
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
    fullJd: application.fullJd ?? null,
    status: application.status,
    archived: application.archived,
    pinned: application.pinned,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  });
}

export function exportSqlFromRecords(
  applications: JobApplication[],
  notes: ApplicationNote[],
  users: BackupJson["users"],
  statusHistory: BackupJson["statusHistory"],
  companies: BackupJson["companies"],
): string {
  const exportedAt = new Date().toISOString();
  const lines: string[] = [
    "-- Applied.dev database backup",
    `-- Exported: ${exportedAt}`,
    "",
    "PRAGMA foreign_keys = OFF;",
    "BEGIN TRANSACTION;",
    "",
    "DROP TABLE IF EXISTS application_status_history;",
    "DROP TABLE IF EXISTS application_notes;",
    "DROP TABLE IF EXISTS applications;",
    "DROP TABLE IF EXISTS companies;",
    "DROP TABLE IF EXISTS users;",
    "",
    readBackupSchemaSql().trim(),
    "",
  ];

  for (const row of users.map(userToRow)) {
    lines.push(
      `INSERT INTO users (id, display_name, email, created_at, updated_at) VALUES (${[
        sqlQuote(row.id),
        sqlQuote(row.display_name),
        sqlQuote(row.email),
        sqlQuote(row.created_at),
        sqlQuote(row.updated_at),
      ].join(", ")});`,
    );
  }

  for (const row of companies.map(companyToRow)) {
    lines.push(
      `INSERT INTO companies (id, name, url, linkedin_url, email, ignored, created_at, updated_at) VALUES (${[
        sqlQuote(row.id),
        sqlQuote(row.name),
        sqlQuote(row.url),
        sqlQuote(row.linkedin_url),
        sqlQuote(row.email),
        String(row.ignored),
        sqlQuote(row.created_at),
        sqlQuote(row.updated_at),
      ].join(", ")});`,
    );
  }

  for (const row of applications.map(applicationToSqlRow)) {
    lines.push(
      `INSERT INTO applications (id, url, linkedin_url, title, company, applied_at, via_recruiter, recruiter_name, recruiter_firm, contact_email, contact_phone, salary_range, desired_salary, notes, full_jd, status, archived, pinned, created_at, updated_at) VALUES (${[
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
        String(row.archived),
        String(row.pinned),
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

  for (const row of statusHistory.map(statusHistoryToRow)) {
    lines.push(
      `INSERT INTO application_status_history (id, application_id, user_id, from_status, to_status, changed_at) VALUES (${[
        sqlQuote(row.id),
        sqlQuote(row.application_id),
        sqlQuote(row.user_id),
        sqlQuote(row.from_status),
        sqlQuote(row.to_status),
        sqlQuote(row.changed_at),
      ].join(", ")});`,
    );
  }

  lines.push("", "COMMIT;", "PRAGMA foreign_keys = ON;", "");
  return lines.join("\n");
}

export function exportSql(db: Database.Database): string {
  return exportSqlFromRecords(
    listApplications(db),
    listNotes(db),
    listUsers(db),
    listStatusHistory(db),
    listCompanies(db),
  );
}

type PasswordHashes = { id: string; email: string | null; password_hash: string }[];

// Backups exclude password hashes, so a replace restore must carry them over for users that still exist.
function clearAllData(db: Database.Database): PasswordHashes {
  const hashes = db
    .prepare("SELECT id, email, password_hash FROM users WHERE password_hash IS NOT NULL")
    .all() as PasswordHashes;
  db.exec(
    `DELETE FROM application_status_history; DELETE FROM application_notes; DELETE FROM applications; DELETE FROM companies; DELETE FROM users;`,
  );
  return hashes;
}

function restorePasswordHashes(db: Database.Database, hashes: PasswordHashes): void {
  // Email travels with the hash: a restored owner without an email could not sign in with the carried-over hash.
  // The credential owner wins an email collision: other restored users lose that email (unique index).
  const clearOthers = db.prepare("UPDATE users SET email = NULL WHERE email = ? AND id <> ?");
  const update = db.prepare("UPDATE users SET email = ?, password_hash = ? WHERE id = ?");
  const present = db.prepare("SELECT 1 FROM users WHERE id = ?");
  for (const { id, email, password_hash } of hashes) {
    // Only when the owner row exists, otherwise the other user's email would be lost for nothing.
    if (present.get(id)) clearOthers.run(email, id);
    update.run(email, password_hash, id);
  }
}

function importJsonData(db: Database.Database, data: BackupJson, mode: ImportMode): ImportResult {
  const upsertApplication = db.prepare(UPSERT_APPLICATION_SQL);
  const upsertNote = db.prepare(UPSERT_NOTE_SQL);
  const upsertUser = db.prepare(UPSERT_USER_SQL);
  const upsertStatusHistory = db.prepare(UPSERT_STATUS_HISTORY_SQL);
  const upsertCompany = db.prepare(UPSERT_COMPANY_SQL);

  const run = db.transaction(() => {
    // v1/v2 backups carry no users; keep the current ones so the owner and credentials survive a replace.
    const users = mode === "replace" && data.users.length === 0 ? listUsers(db) : data.users;
    const hashes = mode === "replace" ? clearAllData(db) : [];

    for (const user of users) {
      upsertUser.run(userToRow(user));
    }

    for (const company of data.companies) {
      upsertCompany.run(companyToRow(company));
    }

    for (const application of data.applications) {
      upsertApplication.run(applicationToRow(application));
    }

    for (const note of data.notes) {
      upsertNote.run(noteToRow(note));
    }

    for (const entry of data.statusHistory) {
      upsertStatusHistory.run(statusHistoryToRow(entry));
    }

    restorePasswordHashes(db, hashes);
  });

  run();

  if (data.statusHistory.length === 0) {
    backfillMissingStatusHistory(db);
  }

  if (data.companies.length === 0) {
    backfillCompaniesFromApplications(db);
  }

  return {
    applications: listApplications(db),
    imported: {
      applications: data.applications.length,
      notes: data.notes.length,
      users: data.users.length,
      statusHistory: data.statusHistory.length,
      companies: data.companies.length,
    },
  };
}

export function importJson(db: Database.Database, raw: unknown, mode: ImportMode): ImportResult {
  return importJsonData(db, parseBackupJson(raw), mode);
}

// Mirrors SQLite's lexer: splits on `;` outside '...', "...", `...` (doubled delimiter escapes) and [...] spans,
// drops `--` line comments, and replaces /* */ block comments (unterminated runs to EOF) with a space.
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      current += ch;
      if (ch === quote) {
        if (quote !== "]" && sql[i + 1] === quote) current += sql[++i];
        else quote = "";
      }
    } else if (ch === "'" || ch === '"' || ch === "`" || ch === "[") {
      quote = ch === "[" ? "]" : ch;
      current += ch;
    } else if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      current += "\n";
    } else if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 1;
      current += " ";
    } else if (ch === ";") {
      statements.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  statements.push(current);
  return statements.map((statement) => statement.trim()).filter((statement) => statement.length > 0);
}

export function extractInsertStatements(sql: string): string[] {
  return splitSqlStatements(sql).filter((statement) => /^INSERT\s+INTO\s+/i.test(statement));
}

function isAllowedSqlBackupStatement(statement: string): boolean {
  const normalized = statement.replace(/\s+/g, " ").trim();

  if (/^PRAGMA\s+foreign_keys\s*=\s*(ON|OFF)$/i.test(normalized)) {
    return true;
  }

  if (/^BEGIN(?:\s+TRANSACTION)?$/i.test(normalized)) {
    return true;
  }

  if (/^COMMIT$/i.test(normalized)) {
    return true;
  }

  if (
    /^DROP TABLE IF EXISTS (?:application_status_history|application_notes|applications|companies|users)$/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (/^CREATE TABLE IF NOT EXISTS applications\s*\(/i.test(normalized)) {
    return true;
  }

  if (/^CREATE TABLE IF NOT EXISTS application_notes\s*\(/i.test(normalized)) {
    return true;
  }

  if (/^CREATE TABLE IF NOT EXISTS users\s*\(/i.test(normalized)) {
    return true;
  }

  if (/^CREATE TABLE IF NOT EXISTS application_status_history\s*\(/i.test(normalized)) {
    return true;
  }

  if (/^CREATE TABLE IF NOT EXISTS companies\s*\(/i.test(normalized)) {
    return true;
  }

  if (/^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS idx_/i.test(normalized)) {
    return true;
  }

  if (
    /^INSERT\s+INTO\s+(?:applications|application_notes|users|application_status_history|companies)\b/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

/**
 * Wraps a validated replace script so the users' id/email/password_hash survive inside its own transaction.
 * Backups carry no credentials; the temp table keeps them for ids that still exist after the restore.
 */
export function withCredentialPreservation(sql: string): string {
  const statements = splitSqlStatements(sql);
  const isBegin = (s: string) => /^BEGIN(?:\s+TRANSACTION)?$/i.test(s.replace(/\s+/g, " ").trim());
  const isCommit = (s: string) => /^COMMIT$/i.test(s.trim());
  const begin = statements.findIndex(isBegin);
  const commit = statements.findLastIndex(isCommit);
  if (begin < 0 || commit < begin) {
    throw new Error("SQL backup replace script must be wrapped in BEGIN and COMMIT");
  }
  statements.splice(
    commit,
    0,
    "ALTER TABLE users ADD COLUMN password_hash TEXT",
    "UPDATE users SET email = NULL WHERE email IN (SELECT email FROM kept_credentials k WHERE k.id <> users.id AND EXISTS (SELECT 1 FROM users u WHERE u.id = k.id))",
    "UPDATE users SET email = (SELECT email FROM kept_credentials k WHERE k.id = users.id), password_hash = (SELECT password_hash FROM kept_credentials k WHERE k.id = users.id) WHERE id IN (SELECT id FROM kept_credentials)",
    "DROP TABLE kept_credentials",
  );
  statements.splice(
    begin + 1,
    0,
    "CREATE TEMP TABLE kept_credentials AS SELECT id, email, password_hash FROM users WHERE password_hash IS NOT NULL",
  );
  return statements.map((statement) => `${statement};`).join("\n");
}

export function assertSqlBackupIsSafe(sql: string): void {
  for (const statement of splitSqlStatements(sql)) {
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

export function countSqlInserts(sql: string): {
  applications: number;
  notes: number;
  users: number;
  statusHistory: number;
  companies: number;
} {
  const inserts = extractInsertStatements(sql);
  let applications = 0;
  let notes = 0;
  let users = 0;
  let statusHistory = 0;
  let companies = 0;

  for (const insert of inserts) {
    if (/INSERT\s+INTO\s+applications\b/i.test(insert)) {
      applications += 1;
    } else if (/INSERT\s+INTO\s+application_notes\b/i.test(insert)) {
      notes += 1;
    } else if (/INSERT\s+INTO\s+users\b/i.test(insert)) {
      users += 1;
    } else if (/INSERT\s+INTO\s+application_status_history\b/i.test(insert)) {
      statusHistory += 1;
    } else if (/INSERT\s+INTO\s+companies\b/i.test(insert)) {
      companies += 1;
    }
  }

  return { applications, notes, users, statusHistory, companies };
}

function sqlInsertTablePriority(insert: string): number {
  if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+users\b/i.test(insert)) {
    return 0;
  }
  if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+companies\b/i.test(insert)) {
    return 1;
  }
  if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+applications\b/i.test(insert)) {
    return 2;
  }
  if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+application_notes\b/i.test(insert)) {
    return 3;
  }
  if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+application_status_history\b/i.test(insert)) {
    return 4;
  }
  return 99;
}

function insertToUpsertStatement(insert: string): string {
  const normalized = insert.replace(/^INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO/i, "INSERT INTO").trim();
  const table = /^INSERT INTO (\w+)\b/i.exec(normalized)?.[1]?.toLowerCase() ?? "";
  if (!Object.hasOwn(UPSERT_CONFLICT_CLAUSES, table)) {
    throw new Error("Unsupported INSERT statement in SQL backup");
  }

  return `${normalized}\n${UPSERT_CONFLICT_CLAUSES[table as keyof typeof UPSERT_CONFLICT_CLAUSES]};`;
}

export function prepareSqlUpsertStatements(sql: string): string[] {
  const inserts = extractInsertStatements(sql);
  if (inserts.length === 0) {
    throw new Error("No INSERT statements found in SQL backup");
  }

  return inserts
    .sort((left, right) => sqlInsertTablePriority(left) - sqlInsertTablePriority(right))
    .map((insert) => insertToUpsertStatement(insert));
}

/** Rows whose stored full_jd changes when sanitized; SQL imports bypass parseBackupJson's sanitizing. */
export function fullJdSanitizeUpdates(
  rows: { id: string; full_jd: string | null }[],
): { id: string; fullJd: string | null }[] {
  const updates: { id: string; fullJd: string | null }[] = [];
  for (const row of rows) {
    if (!row.full_jd) continue;
    const fullJd = sanitizeStoredHtml(row.full_jd);
    if (fullJd !== row.full_jd) updates.push({ id: row.id, fullJd });
  }
  return updates;
}

function importSqlStatements(db: Database.Database, sql: string, mode: ImportMode): ImportResult {
  assertSqlBackupIsSafe(sql);
  const upserts = prepareSqlUpsertStatements(sql);
  const imported = countSqlInserts(sql);

  const run = db.transaction(() => {
    const hashes = mode === "replace" ? clearAllData(db) : [];

    for (const upsert of upserts) {
      db.exec(upsert);
    }

    restorePasswordHashes(db, hashes);

    const rows = db.prepare("SELECT id, full_jd FROM applications WHERE full_jd IS NOT NULL").all() as {
      id: string;
      full_jd: string | null;
    }[];
    const update = db.prepare("UPDATE applications SET full_jd = ? WHERE id = ?");
    for (const { id, fullJd } of fullJdSanitizeUpdates(rows)) update.run(fullJd, id);
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
