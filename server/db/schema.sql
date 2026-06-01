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
  notes TEXT,
  full_jd TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications (applied_at DESC);
