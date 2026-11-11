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
import { log } from "../logging/logger";
import { sanitizeStoredHtml } from "./extractFullJd";
import { readBackupSchemaSql } from "../db/schema";
import type { CompanyRow } from "../db/companyRepositoryShared";
import type { UserRow } from "../db/userRepositoryShared";

import {
  ALLOWED_CREATE_RE,
  ALLOWED_DROP_RE,
  ALLOWED_INSERT_RE,
  BACKUP_TABLES,
  insertSql,
  sqlInsertTablePriority,
  UPSERT_APPLICATION_SQL,
  UPSERT_COMPANY_SQL,
  UPSERT_CONFLICT_CLAUSES,
  UPSERT_NOTE_SQL,
  UPSERT_STATUS_HISTORY_SQL,
  UPSERT_USER_SQL,
  USER_EMAIL_IF_FREE_SQL,
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
  /** Restored users whose email was dropped because the credential holder already uses it. */
  emailsCleared: number;
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

function listApplications(db: Database.Database): JobApplication[] {
  const rows = db.prepare(LIST_APPLICATIONS_SQL).all() as ApplicationBackupRow[];
  return rows.map(rowToApplication);
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

  lines.push(
    ...users.map((r) => insertSql("users", userToRow(r))),
    ...companies.map((r) => insertSql("companies", companyToRow(r))),
    ...applications.map((r) => insertSql("applications", applicationToRow({ ...r, fullJd: r.fullJd ?? null }))),
    ...notes.map((r) => insertSql("application_notes", noteToRow(r))),
    ...statusHistory.map((r) => insertSql("application_status_history", statusHistoryToRow(r))),
  );

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

type UserEmail = { id: string; email: string | null };

function listCredentialHolders(db: Database.Database): UserEmail[] {
  return db.prepare("SELECT id, email FROM users WHERE password_hash IS NOT NULL").all() as UserEmail[];
}

type PasswordHashes = { id: string; email: string | null; password_hash: string }[];

// Backups exclude password hashes, so a replace restore must carry them over for users that still exist.
function clearAllData(db: Database.Database, keepUsers = false): PasswordHashes {
  const hashes = db
    .prepare("SELECT id, email, password_hash FROM users WHERE password_hash IS NOT NULL")
    .all() as PasswordHashes;
  db.exec(
    `DELETE FROM application_status_history; DELETE FROM application_notes; DELETE FROM applications; DELETE FROM companies;${keepUsers ? "" : " DELETE FROM users;"}`,
  );
  return hashes;
}

/** Backup users that lose their email to a different credential holder (replace only when the holder is restored too). */
export function countEmailsCleared(holders: UserEmail[], users: UserEmail[], mode: ImportMode): number {
  const restored = new Set(users.map((u) => u.id));
  const owned = holders.filter((h) => h.email && (mode === "upsert" || restored.has(h.id)));
  const cleared = users.filter((u) => u.email && owned.some((h) => h.email === u.email && h.id !== u.id)).length;
  if (cleared > 0) log.warn("backup restore cleared emails already used by the credential holder", { cleared });
  return cleared;
}

const USER_INSERT_RE = /^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+users\s*\(([^)]*)\)\s*VALUES\s*([\s\S]*)$/i;

/** A SELECT of (id, email) over the script's user rows, or null when it restores none. */
export function backupUserRowsSql(sql: string): string | null {
  const selects = extractInsertStatements(sql).flatMap((insert) => {
    const m = USER_INSERT_RE.exec(insert);
    return m ? [`SELECT id, email FROM (WITH i(${m[1]}) AS (VALUES ${m[2]}) SELECT * FROM i)`] : [];
  });
  return selects.length > 0 ? selects.join(" UNION ALL ") : null;
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

  let emailsCleared = 0;
  const run = db.transaction(() => {
    // v1/v2 backups carry no users; keep the current ones so the owner and credentials survive a replace.
    const users = mode === "replace" && data.users.length === 0 ? listUsers(db) : data.users;
    emailsCleared = countEmailsCleared(listCredentialHolders(db), users, mode);
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
    emailsCleared,
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

  if (ALLOWED_DROP_RE.test(normalized) || ALLOWED_CREATE_RE.test(normalized)) {
    return true;
  }

  if (/^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS idx_/i.test(normalized)) {
    return true;
  }

  if (ALLOWED_INSERT_RE.test(normalized)) {
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
  // A script without user rows keeps the current users, like the JSON path.
  const keepUsers = !statements.some((s) => /^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+users\b/i.test(s));
  const userCols = "id, display_name, email, created_at, updated_at";
  statements.splice(
    commit,
    0,
    ...(keepUsers
      ? [`INSERT INTO users (${userCols}) SELECT ${userCols} FROM kept_users`, "DROP TABLE kept_users"]
      : []),
    "ALTER TABLE users ADD COLUMN password_hash TEXT",
    "UPDATE users SET email = NULL WHERE email IN (SELECT email FROM kept_credentials k WHERE k.id <> users.id AND EXISTS (SELECT 1 FROM users u WHERE u.id = k.id))",
    "UPDATE users SET email = (SELECT email FROM kept_credentials k WHERE k.id = users.id), password_hash = (SELECT password_hash FROM kept_credentials k WHERE k.id = users.id) WHERE id IN (SELECT id FROM kept_credentials)",
    "DROP TABLE kept_credentials",
  );
  statements.splice(
    begin + 1,
    0,
    "CREATE TEMP TABLE kept_credentials AS SELECT id, email, password_hash FROM users WHERE password_hash IS NOT NULL",
    ...(keepUsers ? [`CREATE TEMP TABLE kept_users AS SELECT ${userCols} FROM users`] : []),
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

export function countSqlInserts(sql: string): ImportResult["imported"] {
  const counts = { applications: 0, notes: 0, users: 0, statusHistory: 0, companies: 0 };
  for (const insert of extractInsertStatements(sql)) {
    const name = /^INSERT\s+INTO\s+(\w+)\b/i.exec(insert)?.[1]?.toLowerCase();
    const t = BACKUP_TABLES.find((b) => b.table === name);
    if (t) counts[t.key] += 1;
  }
  return counts;
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
    .map((insert) => userInsertToUpsert(insert) ?? insertToUpsertStatement(insert));
}

// Wraps a user's VALUES in a CTE so its email can be nulled when another user holds it (the unique index would fail).
function userInsertToUpsert(insert: string): string | null {
  const match = USER_INSERT_RE.exec(insert);
  if (!match) return null;
  const cols = "id, display_name, email, created_at, updated_at";
  return `WITH i(${match[1]}) AS (VALUES ${match[2]})
INSERT INTO users (${cols}) SELECT id, display_name, ${USER_EMAIL_IF_FREE_SQL("i.email", "i.id")}, created_at, updated_at FROM i WHERE true
${UPSERT_CONFLICT_CLAUSES.users};`;
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

  const userRowsSql = backupUserRowsSql(sql);
  let emailsCleared = 0;
  const run = db.transaction(() => {
    if (userRowsSql) {
      emailsCleared = countEmailsCleared(listCredentialHolders(db), db.prepare(userRowsSql).all() as UserEmail[], mode);
    }
    // A script without user rows keeps the current users, like the JSON path.
    const hashes = mode === "replace" ? clearAllData(db, imported.users === 0) : [];

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
    emailsCleared,
  };
}

export function importSql(db: Database.Database, sql: string, mode: ImportMode): ImportResult {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    throw new Error("SQL backup is empty");
  }

  return importSqlStatements(db, trimmed, mode);
}

export function backupFilename(format: "sql" | "json", exportedAt = new Date()): string {
  const stamp = exportedAt.toISOString().replace(/[:.]/g, "-");
  return `applied-backup-${stamp}.${format}`;
}
