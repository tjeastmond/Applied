# Applied.dev — Agent Guide

Single-page job application tracker. Users add/edit applications in a modal, parse job posting URLs for title/company/description, and browse saved applications as cards.

---

## Learned User Preferences

- Use Shadcn UI for frontend components
- Show status feedback with Sonner toasts in the bottom-right corner, not inline alert banners
- Add and edit job applications in a Shadcn Dialog modal, not inline on the page
- Do not edit attached plan files when implementing plans
- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for branch names, commit messages, and PR titles

---

## Quick Start

```bash
bun install          # install dependencies
bun run dev          # Bun API (port 3000) + Vite dev server (proxies /api → 3000)
bun run check        # typecheck + tests + lint + format + build (full CI gate)
```

**Production:**

```bash
bun run build        # vite build → dist/
bun run start        # NODE_ENV=production; Bun serves dist/ + /api on port 3000
```

**Environment variables:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP port for Bun server |
| `HOST` | `127.0.0.1` | Bind address |
| `DATABASE_PATH` | `data/applied.db` | SQLite file path |
| `NODE_ENV` | — | Set to `production` to enable static file serving from `dist/` |

---

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Frontend | React 19, Vite 6, TypeScript (strict) |
| Styling | Tailwind CSS 4, Shadcn UI (`base-nova` style), Geist Variable font |
| Icons | Lucide React |
| Toasts | Sonner (`<Toaster />` in `src/main.tsx`) |
| Backend | Bun.serve (no framework) |
| Database | SQLite via `bun:sqlite` |
| HTML parsing | linkedom (server-side job URL fetch + parse) |
| Tests | Vitest (unit) + `bun:test` (SQLite integration) |
| Lint/format | ESLint 9 (type-checked), Prettier + tailwind plugin |

---

## Architecture

```
Browser (Vite dev or static dist/)
  └─ src/App.tsx          React UI, form state, toasts
  └─ src/api.ts           fetch() wrappers for /api/*
       │
       ▼  (dev: Vite proxy; prod: same origin)
Bun server (server/index.ts)
  └─ /api/*               JSON REST handlers
  └─ /*                   Static files from dist/ (production only)
  └─ SqliteJobApplicationRepository
       └─ data/applied.db
  └─ parseJobUrl service  Fetches external job URLs, extracts metadata
```

**Shared types:** `src/types.ts` is imported by both frontend and server. Keep API shapes in sync here.

**Repository pattern:** `server/repositories/jobApplicationRepository.ts` defines the interface; `server/db/sqliteRepository.ts` is the only implementation. Use the interface when adding alternate backends or mocking.

---

## Directory Layout

```
applied.dev/
├── src/                          # Frontend (React)
│   ├── App.tsx                   # Main page: list, dialog form, cards
│   ├── api.ts                    # Client-side API helpers
│   ├── types.ts                  # Shared domain types (frontend + server)
│   ├── main.tsx                  # React root + Sonner Toaster
│   ├── styles.css                # Tailwind + Shadcn theme tokens
│   ├── lib/
│   │   ├── applicationForm.ts    # Form state, validation, conversions
│   │   └── utils.ts              # cn() helper (clsx + tailwind-merge)
│   └── components/ui/          # Shadcn components (do not lint)
├── server/
│   ├── index.ts                  # Bun.serve entry, routing, validation
│   ├── db/
│   │   ├── schema.sql            # Table DDL
│   │   ├── migrate.ts            # Runs schema + incremental ALTERs
│   │   └── sqliteRepository.ts   # CRUD implementation
│   ├── repositories/
│   │   └── jobApplicationRepository.ts
│   └── services/
│       ├── parseJobUrl.ts        # Fetch URL, extract title/company/JD
│       └── extractFullJd.ts      # Sanitize HTML → minimal full_jd
├── tests/                        # Vitest (*.test.ts) + Bun (*.bun.test.ts)
├── data/                         # SQLite DB (gitignored); auto-created
├── .ai/issues.md                 # Track bugs/issues found during work
├── components.json               # Shadcn config (style: base-nova)
├── vite.config.ts                # @ alias, /api proxy → localhost:3000
├── vitest.config.ts              # Excludes *.bun.test.ts; externalizes bun:
└── AGENTS.md                     # This file
```

---

## Data Model

### `JobApplication` (`src/types.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | UUID, server-generated |
| `url` | `string` | **Required** — job posting URL |
| `linkedinUrl` | `string \| null` | Optional |
| `title` | `string \| null` | **Required on create** (validated server + client) |
| `company` | `string \| null` | **Required on create** |
| `appliedAt` | `string` | **Required** — ISO date `YYYY-MM-DD` |
| `viaRecruiter` | `boolean` | When false, recruiter fields cleared on save |
| `recruiterName` | `string \| null` | Only when `viaRecruiter` |
| `recruiterFirm` | `string \| null` | Only when `viaRecruiter` |
| `contactEmail` | `string \| null` | |
| `contactPhone` | `string \| null` | |
| `notes` | `string \| null` | User-written notes (separate from parsed JD) |
| `fullJd` | `string \| null` | Parsed job description — cleaned minimal HTML |
| `status` | `ApplicationStatus` | `"applied" \| "interviewing" \| "rejected" \| "offer"` — defaults to `"applied"` |
| `createdAt` | `string` | ISO timestamp |
| `updatedAt` | `string` | ISO timestamp |

**SQLite column mapping:** snake_case in DB (`linkedin_url`, `applied_at`, `full_jd`, etc.); camelCase in TypeScript via `rowToApplication()`.

**List order:** `applied_at DESC, created_at DESC`.

### Schema migrations

- `server/db/schema.sql` — `CREATE TABLE IF NOT EXISTS` + index
- `server/db/migrate.ts` — runs schema on startup; includes legacy `ALTER TABLE` for `full_jd` if missing
- Add new columns via `migrate.ts` (check `PRAGMA table_info`) — do not rely on ALTER in schema.sql alone for existing DBs

---

## REST API

All endpoints return JSON unless noted. Errors: `{ "error": "message" }` with 4xx status.

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/api/applications` | — | `JobApplication[]` |
| `POST` | `/api/applications` | `CreateJobApplicationInput` | `JobApplication` (201) |
| `PATCH` | `/api/applications/:id` | `Partial<CreateJobApplicationInput>` | `JobApplication` or 404 |
| `DELETE` | `/api/applications/:id` | — | 204 or 404 |
| `POST` | `/api/jobs/parse` | `{ "url": string }` | `ParseJobUrlResult` |

**Create validation** (`server/index.ts`): `url`, `title`, `company`, `appliedAt` must be non-empty strings.

**Parse response:**

```ts
// success
{ ok: true, title: string | null, company: string | null, fullJd: string | null }
// failure
{ ok: false, error: string }
```

Client helpers live in `src/api.ts`. Throws `Error` with server message on non-OK responses.

---

## Frontend

### Main UI flow (`src/App.tsx`)

1. **List view** — cards sorted by server; empty state with CTA
2. **Add/Edit** — Shadcn `Dialog` with `ApplicationFormFields`
3. **Parse** — "Parse" button on URL field calls `/api/jobs/parse`; fills `title`, `company`, `fullJd` in form state (not shown as editable field)
4. **Save** — validates required fields client-side (`isFormValid`), then POST or PATCH
5. **Delete** — `window.confirm` then DELETE
6. **Job description** — card link opens second Dialog rendering `fullJd` via `dangerouslySetInnerHTML` with scoped Tailwind prose classes

### Form logic (`src/lib/applicationForm.ts`)

- `FormState` = `CreateJobApplicationInput & { id?: string }`
- `emptyForm()` — defaults `appliedAt` to today, `status` to `"applied"`
- `formToInput()` / `applicationToForm()` — bridge between form and API
- `isFormValid()` — url, title, company, appliedAt all non-empty

### Shadcn UI

- Config: `components.json` (style `base-nova`, `@/` aliases)
- Add components: `bunx shadcn@latest add <component>`
- **ESLint ignores `src/components/ui/**`** — don't hand-edit lint rules for generated files
- Installed: alert, badge, button, card, checkbox, dialog, field, input, input-group, label, separator, sonner, textarea

### Path alias

`@/*` → `src/*` (configured in `tsconfig.json` and `vite.config.ts`)

---

## Server Services

### Job URL parsing (`server/services/parseJobUrl.ts`)

1. Validates URL (http/https only)
2. Fetches with 8s timeout, browser User-Agent
3. Parses HTML with linkedom
4. **Title:** `og:title` → `<title>` → first `<h1>`
5. **Company:** `og:site_name` → `application-name` meta → hostname heuristic
6. **fullJd:** delegated to `extractFullJd.ts`

### JD extraction (`server/services/extractFullJd.ts`)

- Finds description root via CSS selectors (`job-description`, `article`, `main`, etc.)
- Strips to allowed tags: `p`, `ul`, `ol`, `li`, `h2`–`h4`, `strong`, `em`, `br`
- Removes attributes, boilerplate (EEO, privacy, etc.), deduplicates blocks
- Prepends `<strong>Summary</strong>` from first sentences when available
- Returns `null` if nothing useful extracted

---

## Testing

| Command | What it runs |
|---------|--------------|
| `bun vitest` | Watch mode — `tests/**/*.test.ts` (excludes `*.bun.test.ts`) |
| `bun vitest run` | Single run for Vitest tests |
| `bun test tests/sqliteRepository.bun.test.ts` | Bun-native test using `bun:sqlite` in-memory |
| `bun run test:run` | Both Vitest + Bun tests |
| `bun run check` | Full gate before shipping |

**Test files:**

- `tests/applicationForm.test.ts` — form validation
- `tests/parseJobUrl.test.ts` — parse service (mocked fetch)
- `tests/extractFullJd.test.ts` — JD HTML sanitization
- `tests/sqliteRepository.bun.test.ts` — full CRUD lifecycle

**Vitest config** externalizes `bun:` imports so server code can be imported without running under Bun.

---

## Git: Branches, Commits, and PRs

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) for **all** branch names, commit messages, and pull request titles.

### Branch names

Use the commit type as a prefix, then a short kebab-case slug:

```
feat/status-picker
fix/parse-timeout
docs/agents-guide
refactor/repository-layer
```

Avoid generic names like `updates`, `wip`, or `fix-stuff`.

### Commit messages

```
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

| Type | When to use |
|------|-------------|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change without behavior change |
| `test` | Tests only |
| `chore` | Tooling, deps, housekeeping |
| `ci` | CI/CD changes |
| `perf` | Performance improvement |

**Examples:**

```
feat(ui): add application status picker

fix(parse): handle non-HTML responses gracefully

docs: expand AGENTS.md with git workflow

feat(api)!: rename applied_at to apply_date

BREAKING CHANGE: clients must send applyDate instead of appliedAt
```

**Practices:**

- One logical change per commit; split unrelated work
- Description in imperative mood (`add`, not `added`)
- Lowercase start is fine; stay consistent within the repo
- Use `!` or a `BREAKING CHANGE:` footer for breaking changes

### Pull request titles

PR titles use the **same format as commit messages** — reviewers and merge history stay readable:

```
feat(ui): add application status picker
fix: prevent empty title on parse failure
```

PR descriptions should include a **Summary** (what/why) and a **Test plan** (how you verified). Keep the title concise; put detail in the body.

Squash-merge or rebase so `main` history reads as conventional commits.

---

## Code Conventions

- **TypeScript strict** — `verbatimModuleSyntax`, no unused locals/params
- **Git** — Conventional Commits for branches, commits, and PR titles (see above)
- **Prettier** — run `bun run format` before commit; Tailwind class sorting via plugin
- **No inline alerts for UX feedback** — use Sonner toasts
- **Modals for forms** — not inline editing on the list page
- **Minimal diffs** — match existing patterns; don't over-abstract
- **Issue tracking** — log bugs in `.ai/issues.md` as `- [ ] Description`

---

## Known Gaps / Extension Points

These exist in the data layer but are **not yet exposed in the UI**:

- **`status`** — stored and updatable via API; always defaults to `"applied"`; no status picker or badge on cards
- **`fullJd` in form** — populated by Parse but not editable in the dialog; only viewable from the card's "job description" link

Likely next features: status workflow UI, filtering/sorting, search, export, auth (currently single-user local app).

---

## Dev vs Production

| | Development | Production |
|---|-------------|------------|
| Frontend | Vite HMR (separate process) | Served from `dist/` by Bun |
| API | Bun on `:3000` | Same Bun process |
| API calls | Vite proxies `/api` → `localhost:3000` | Same-origin `/api` |
| Database | `data/applied.db` (local file) | Same |

`bun run dev` runs `dev:server` and `dev:vite` in parallel (`&`). Both must be running for full local UX.

---

## Learned Workspace Facts

- Applied.dev is a single-page job application tracker
- Stack: Bun runtime, Vite build, strict TypeScript, React, Tailwind CSS, Shadcn UI
- Dev server and API run on port 3000 (`PORT` env overrides default)
- Tooling includes Prettier, ESLint, and Vitest (run via `bun`)
- Required application form fields: job posting URL, title, company, apply date; all other fields are optional
- Parsed job postings store cleaned minimal HTML in `full_jd`, separate from user notes
- SQLite persistence via Bun (`data/applied.db` by default)
- Git workflow uses Conventional Commits for branch names, commit messages, and PR titles
