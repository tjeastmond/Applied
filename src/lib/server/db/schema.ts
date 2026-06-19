import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const APPLICATION_LEGACY_COLUMNS = ["full_jd", "salary_range", "desired_salary"] as const;

/** Application data only — excludes local auth secrets such as app_access_config. */
export const BACKUP_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  linkedin_url TEXT,
  title TEXT,
  company TEXT,
  applied_at TEXT NOT NULL,
  via_recruiter INTEGER NOT NULL DEFAULT 0,
  recruiter_name TEXT,
  recruiter_firm TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  salary_range TEXT,
  desired_salary TEXT,
  notes TEXT,
  full_jd TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications (applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_updated_at ON applications (updated_at DESC);

CREATE TABLE IF NOT EXISTS application_notes (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_application_notes_application_id ON application_notes (application_id, created_at DESC);`;

export function readSchemaSql(): string {
  return readFileSync(join(__dirname, "schema.sql"), "utf-8");
}

export function readBackupSchemaSql(): string {
  return BACKUP_SCHEMA_SQL;
}
