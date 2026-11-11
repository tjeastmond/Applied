// Single source of truth for per-table upsert conflict clauses (used by every SQL upsert path).
export const UPSERT_CONFLICT_CLAUSES = {
  applications: `ON CONFLICT(id) DO UPDATE SET
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
  archived = excluded.archived,
  pinned = excluded.pinned,
  updated_at = excluded.updated_at`,
  application_notes: `ON CONFLICT(id) DO UPDATE SET
  application_id = excluded.application_id,
  content = excluded.content`,
  users: `ON CONFLICT(id) DO UPDATE SET
  display_name = excluded.display_name,
  email = CASE WHEN users.password_hash IS NOT NULL THEN users.email ELSE excluded.email END,
  updated_at = excluded.updated_at`,
  application_status_history: `ON CONFLICT(id) DO UPDATE SET
  application_id = excluded.application_id,
  user_id = excluded.user_id,
  from_status = excluded.from_status,
  to_status = excluded.to_status,
  changed_at = excluded.changed_at`,
  companies: `ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  url = excluded.url,
  linkedin_url = excluded.linkedin_url,
  email = excluded.email,
  ignored = excluded.ignored,
  updated_at = excluded.updated_at`,
} as const;

export const UPSERT_APPLICATION_SQL = `INSERT INTO applications (
  id, url, linkedin_url, title, company, applied_at, via_recruiter, recruiter_name, recruiter_firm,
  contact_email, contact_phone, salary_range, desired_salary, notes, full_jd, status, archived, pinned, created_at, updated_at
) VALUES (
  @id, @url, @linkedin_url, @title, @company, @applied_at, @via_recruiter, @recruiter_name, @recruiter_firm,
  @contact_email, @contact_phone, @salary_range, @desired_salary, @notes, @full_jd, @status, @archived, @pinned, @created_at, @updated_at
) ${UPSERT_CONFLICT_CLAUSES.applications}`;

export const UPSERT_NOTE_SQL = `INSERT INTO application_notes (id, application_id, content, created_at)
VALUES (@id, @application_id, @content, @created_at)
${UPSERT_CONFLICT_CLAUSES.application_notes}`;

// An incoming email already held by another user is dropped (the unique index would fail the import).
export const USER_EMAIL_IF_FREE_SQL = (email: string, id: string) =>
  `CASE WHEN EXISTS (SELECT 1 FROM users WHERE email = ${email} AND id <> ${id}) THEN NULL ELSE ${email} END`;

export const UPSERT_USER_SQL = `INSERT INTO users (id, display_name, email, created_at, updated_at)
VALUES (@id, @display_name, ${USER_EMAIL_IF_FREE_SQL("@email", "@id")}, @created_at, @updated_at)
${UPSERT_CONFLICT_CLAUSES.users}`;

export const UPSERT_STATUS_HISTORY_SQL = `INSERT INTO application_status_history (
  id, application_id, user_id, from_status, to_status, changed_at
) VALUES (@id, @application_id, @user_id, @from_status, @to_status, @changed_at)
${UPSERT_CONFLICT_CLAUSES.application_status_history}`;

export const UPSERT_COMPANY_SQL = `INSERT INTO companies (id, name, url, linkedin_url, email, ignored, created_at, updated_at)
VALUES (@id, @name, @url, @linkedin_url, @email, @ignored, @created_at, @updated_at)
${UPSERT_CONFLICT_CLAUSES.companies}`;

// Backup tables in FK-safe order (users -> companies -> applications -> children); drives export, allowlist, counts and import ordering.
export const BACKUP_TABLES = [
  { table: "users", key: "users", cols: ["id", "display_name", "email", "created_at", "updated_at"] },
  {
    table: "companies",
    key: "companies",
    cols: ["id", "name", "url", "linkedin_url", "email", "ignored", "created_at", "updated_at"],
  },
  {
    table: "applications",
    key: "applications",
    cols: [
      "id",
      "url",
      "linkedin_url",
      "title",
      "company",
      "applied_at",
      "via_recruiter",
      "recruiter_name",
      "recruiter_firm",
      "contact_email",
      "contact_phone",
      "salary_range",
      "desired_salary",
      "notes",
      "full_jd",
      "status",
      "archived",
      "pinned",
      "created_at",
      "updated_at",
    ],
  },
  { table: "application_notes", key: "notes", cols: ["id", "application_id", "content", "created_at"] },
  {
    table: "application_status_history",
    key: "statusHistory",
    cols: ["id", "application_id", "user_id", "from_status", "to_status", "changed_at"],
  },
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number]["table"];

function sqlQuote(value: string | null | undefined): string {
  return value === null || value === undefined ? "NULL" : `'${value.replace(/'/g, "''")}'`;
}

/** One export INSERT; the column allowlist comes from BACKUP_TABLES. Numbers (booleans) are emitted bare. */
export function insertSql(table: BackupTable, row: Record<string, string | number | null | undefined>): string {
  const { cols } = BACKUP_TABLES.find((t) => t.table === table)!;
  const values = cols.map((c) => (typeof row[c] === "number" ? String(row[c]) : sqlQuote(row[c] as string | null)));
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${values.join(", ")});`;
}

const TABLE_NAMES = BACKUP_TABLES.map((t) => t.table).join("|");
export const ALLOWED_DROP_RE = new RegExp(`^DROP TABLE IF EXISTS (?:${TABLE_NAMES})$`, "i");
export const ALLOWED_CREATE_RE = new RegExp(`^CREATE TABLE IF NOT EXISTS (?:${TABLE_NAMES})\\s*\\(`, "i");
export const ALLOWED_INSERT_RE = new RegExp(`^INSERT\\s+INTO\\s+(?:${TABLE_NAMES})\\b`, "i");

/** Index of the insert's table in BACKUP_TABLES (FK order), 99 when unknown. */
export function sqlInsertTablePriority(insert: string): number {
  const name = /INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+(\w+)\b/i.exec(insert)?.[1]?.toLowerCase();
  const i = BACKUP_TABLES.findIndex((t) => t.table === name);
  return i < 0 ? 99 : i;
}
