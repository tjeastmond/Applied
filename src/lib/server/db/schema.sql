CREATE TABLE IF NOT EXISTS applications (
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
  pinned INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_application_notes_application_id ON application_notes (application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_access_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_api_tokens_active ON agent_api_tokens (revoked_at, created_at DESC);
