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
  email = excluded.email,
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

export const UPSERT_USER_SQL = `INSERT INTO users (id, display_name, email, created_at, updated_at)
VALUES (@id, @display_name, @email, @created_at, @updated_at)
${UPSERT_CONFLICT_CLAUSES.users}`;

export const UPSERT_STATUS_HISTORY_SQL = `INSERT INTO application_status_history (
  id, application_id, user_id, from_status, to_status, changed_at
) VALUES (@id, @application_id, @user_id, @from_status, @to_status, @changed_at)
${UPSERT_CONFLICT_CLAUSES.application_status_history}`;

export const UPSERT_COMPANY_SQL = `INSERT INTO companies (id, name, url, linkedin_url, email, ignored, created_at, updated_at)
VALUES (@id, @name, @url, @linkedin_url, @email, @ignored, @created_at, @updated_at)
${UPSERT_CONFLICT_CLAUSES.companies}`;
