# Applied.dev — Agent Guide

Single-page job application tracker. Users add/edit applications in a modal, parse job posting URLs for title/company/description, and browse saved applications as cards.

---

## Learned User Preferences

- Use Shadcn UI for frontend components
- Show status feedback with Sonner toasts in the top-right corner; success toasts pastel green with darker green border, errors red — not inline alert banners
- Add applications in a Shadcn Dialog modal; view/edit in `ApplicationDetailSheet` (card click): status saves immediately in the sheet (same path as cards; `isManualSaveFormDirty` excludes status from unsaved-close prompt); notes default newest-first with sort picker (newest/oldest, persisted in `localStorage` as `applied-dev-note-sort`), linkify http(s) URLs in note body with long URLs truncated inside the border, edit/copy/delete on note date row (muted ghost icons; inline textarea with Save Note / Cancel when editing), compose row above the notes list (textarea with min-height plus square green height-matched Save Note button on the right); unsaved edits show Alert Dialog on close (Save Now, Don't Save with `warnOutline`, Cancel keeps editing); Cmd/Ctrl+S saves dirty fields and prevents browser save (info toast "No changes." when clean); Cmd/Ctrl+Enter saves a new or edited note; Escape cancels note edit
- Cmd+K (Mac) / Ctrl+K (Windows) opens the new application modal
- Save/submit buttons green and title case; Cancel uses `cancelOutline` (red border, transparent background, light red tint on hover) in modals and sheets
- Form inputs: blue border on focus without a gray focus ring; red border (`aria-invalid`) on required fields left empty after a failed submit; date inputs use a muted calendar picker icon; list filters in `ApplicationFilters`: search above equal-width company/status multi-selects labeled "Filter By Company" and "Filter By Status" with fixed trigger widths, animated chevrons, and no layout shift when menus open; always-visible clear-filters icon button (pale red background and white X when active, muted X when disabled, border unchanged when active; `cursor-not-allowed` on wrapper when inactive); double-tap Escape clears filters on card view; `/` focuses search when sheet closed and no field focused; `Separator` below the filter block; keep controls `h-8` via `FILTER_CONTROL_HEIGHT_CLASS` in `src/lib/filterControls.ts`
- Add-application dialog: hide notes (manage in detail drawer); no section dividers; recruiter/contact fields optional by default; auto-parse on URL paste; on open, clipboard-only URL prefill, parse, then focus Save Application
- Label the field "Company LinkedIn URL"; use "Contact Name" for the recruiter name field; optional salary fields labeled "Salary Range" (parsed from postings) and "Desired Salary" (user-entered only) in `ApplicationFormFields`; when `linkedinUrl` is set, show a LinkedIn link before Job Description on cards and sheet via `ApplicationMetadataLine`
- Use Shadcn Alert Dialog for delete confirmations, not `window.confirm`; no edit/delete on application cards — delete only from the detail drawer
- Application cards use color-coded `ApplicationStatusPicker` (tag-like dropdown, closes on select; Applied first, then alphabetical); job URLs via `JobDescriptionLink` with copy icon; drawer overlay blurs background; `APPLIED.` title button clears filters and resets to page 1 without scrolling; header has icon-only `AdminDialog` (settings icon) for backup/export, Copy All URLs, and agent token management, plus Add Application; card pagination supports 5/10/20/50 per page plus View all, persisted as `applied-dev-page-size`
- Light/dark theme toggle in header (Lucide Sun/Moon); persist choice in `localStorage` (`applied-dev-theme`); default light; dark-mode header toolbar outline buttons use `header-toolbar-outline` in `styles.css` for lighter borders and visible hover
- Links: no default underline; left-to-right underline animates on hover/focus for `a[href]`; sheet header job title uses `link-plain` plus `ExternalLinkIcon` (no animated underline)

---

## Quick Start

```bash
pnpm install         # install dependencies
pnpm dev             # Next.js dev server with Turbopack (port 3030 from .env.local)
pnpm dev:clean       # wipe .next and start dev (if HMR/CSS breaks)
pnpm logs:tail       # tail local server logs (data/logs/current.log)
pnpm run check       # typecheck + tests + lint + format + build (full CI gate)
```

**Production:**

```bash
pnpm run build       # next build
pnpm run start       # next start (production server)
```

**Environment variables:**

Local defaults live in `.env.local`; copy from `.env.example` when bootstrapping a fresh checkout.

| Variable             | Default           | Purpose                                                                                           |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_PROVIDER`  | `sqlite`          | Database backend: `sqlite` for local file storage or `turso` for Turso Cloud                      |
| `DATABASE_PATH`      | `data/applied.db` | SQLite file path when `DATABASE_PROVIDER=sqlite`                                                  |
| `TURSO_DATABASE_URL` | —                 | Turso Cloud database URL when `DATABASE_PROVIDER=turso`                                           |
| `TURSO_AUTH_TOKEN`   | —                 | Turso Cloud auth token when `DATABASE_PROVIDER=turso`                                             |
| `AGENT_API_TOKEN`    | —                 | Optional bootstrap bearer for `/api/agent/*`; prefer named DB tokens via Admin → Agent API Tokens |
| `APP_ACCESS_TOKEN`   | —                 | App access token for browser session login and `/api/*` routes (not agent)                        |
| `LOG_ENABLED`        | `true`            | Write logs to local file; set `false` on Vercel                                                   |
| `LOG_LEVEL`          | `info`            | Minimum level: `debug`, `info`, `warn`, or `error`                                                |
| `LOG_DIR`            | `data/logs`       | Directory for rotated log files                                                                   |
| `LOG_FILE`           | `applied.log`     | Base log filename                                                                                 |
| `LOG_MAX_SIZE`       | `5m`              | Rotate when file exceeds this size                                                                |
| `LOG_MAX_FILES`      | `7`               | Number of rotated files to keep                                                                   |
| `NODE_ENV`           | —                 | `production` for optimized build                                                                  |
| `PORT`               | `3030`            | HTTP port for `pnpm dev` and `pnpm start`; read from `.env.local` by default                      |

---

## Stack

| Layer        | Technology                                                                    |
| ------------ | ----------------------------------------------------------------------------- |
| Runtime      | Node.js                                                                       |
| Package mgr  | pnpm                                                                          |
| Framework    | Next.js 15 (App Router)                                                       |
| Frontend     | React 19, TypeScript (strict)                                                 |
| Styling      | Tailwind CSS 4, Shadcn UI (`base-nova` style), Roboto Mono (self-hosted)      |
| Icons        | Lucide React                                                                  |
| Toasts       | Sonner (`<Toaster />` in `src/app/layout.tsx`)                                |
| Backend      | Next.js Route Handlers (`src/app/api/**`)                                     |
| Database     | SQLite via `better-sqlite3`                                                   |
| HTML parsing | linkedom (server-side job URL fetch + parse)                                  |
| Tests        | Vitest (unit + SQLite integration)                                            |
| Logging      | pino → `data/logs/` (JSON lines, custom size rotation, `current.log` symlink) |
| Lint/format  | ESLint 9 (type-checked), Prettier + tailwind plugin                           |

---

## Architecture

```
Browser
  └─ src/app/page.tsx           Client UI: list, dialog form, cards
  └─ src/app/layout.tsx         Root layout + Sonner Toaster
  └─ src/api.ts                 fetch() wrappers for /api/*
       │
       ▼  (same origin)
Next.js App Router
  └─ src/app/api/**             Route handlers (JSON REST)
  └─ src/lib/server/db.ts       Singleton DB + repository
  └─ SqliteJobApplicationRepository
       └─ data/applied.db
  └─ parseJobUrl service        Fetches external job URLs, extracts metadata
```

**Shared types:** `src/types.ts` is imported by both client and server code. Keep API shapes in sync here.

**Repository pattern:** `src/lib/server/repositories/jobApplicationRepository.ts` defines the interface; `src/lib/server/db/sqliteRepository.ts` is the only implementation. Use the interface when adding alternate backends or mocking.

---

## Directory Layout

```
applied.dev/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, metadata, Toaster
│   │   ├── page.tsx                # Main page: list, dialog form, cards
│   │   └── api/
│   │       ├── applications/
│   │       │   ├── route.ts        # GET list, POST create
│   │       │   └── [id]/route.ts   # PATCH update, DELETE
│   │       └── jobs/parse/route.ts # POST parse job URL
│   ├── api.ts                      # Client-side API helpers
│   ├── types.ts                    # Shared domain types
│   ├── styles.css                  # Tailwind + Shadcn theme tokens
│   ├── middleware.ts               # Next.js middleware (placeholder)
│   ├── lib/
│   │   ├── applicationForm.ts      # Form state, validation, conversions
│   │   ├── utils.ts                # cn() helper (clsx + tailwind-merge)
│   │   └── server/
│   │       ├── db.ts               # DB singleton + getRepository()
│   │       ├── validation.ts       # Request body validation
│   │       ├── db/
│   │       │   ├── schema.sql      # Table DDL
│   │       │   ├── migrate.ts      # Runs schema + incremental ALTERs
│   │       │   └── sqliteRepository.ts
│   │       ├── repositories/
│   │       │   └── jobApplicationRepository.ts
│   │       ├── logging/            # pino logger, config, rotation, sanitize
│   │       │   ├── logger.ts
│   │       │   ├── config.ts
│   │       │   ├── sanitize.ts
│   │       │   └── types.ts
│   │       └── services/
│   │           ├── parseJobUrl.ts  # Fetch URL, extract title/company/JD
│   │           └── extractFullJd.ts
│   └── components/ui/              # Shadcn components (do not lint)
├── scripts/
│   ├── dev-clean.sh                # pnpm dev entry (wipe .next, start Turbopack)
│   ├── ensure-log-file.ts          # init log dir/symlink for logs:tail
│   └── logs-tail.sh                # pnpm logs:tail entry
├── tests/                          # Vitest (*.test.ts)
├── data/                           # SQLite DB + logs (gitignored); auto-created
├── .cursor/rules/logging.mdc       # Agent logging conventions
├── .ai/issues.md                   # Track bugs/issues found during work
├── components.json                 # Shadcn config (style: base-nova)
├── next.config.ts                  # Next.js config (externalizes better-sqlite3, pino)
├── postcss.config.mjs              # Tailwind PostCSS
├── vitest.config.ts
└── AGENTS.md                       # This file
```

---

## Data Model

### `JobApplication` (`src/types.ts`)

| Field           | Type                | Notes                                                                             |
| --------------- | ------------------- | --------------------------------------------------------------------------------- |
| `id`            | `string`            | UUID, server-generated                                                            |
| `url`           | `string`            | **Required** — job posting URL                                                    |
| `linkedinUrl`   | `string \| null`    | Optional                                                                          |
| `title`         | `string \| null`    | **Required on create** (validated server + client)                                |
| `company`       | `string \| null`    | **Required on create**                                                            |
| `appliedAt`     | `string`            | **Required** — ISO date `YYYY-MM-DD`                                              |
| `viaRecruiter`  | `boolean`           | When false, recruiter fields cleared on save                                      |
| `recruiterName` | `string \| null`    | Only when `viaRecruiter`                                                          |
| `recruiterFirm` | `string \| null`    | Only when `viaRecruiter`                                                          |
| `contactEmail`  | `string \| null`    |                                                                                   |
| `contactPhone`  | `string \| null`    |                                                                                   |
| `salaryRange`   | `string \| null`    | Optional — posting pay range; parsed from job URLs when available (max 100 chars) |
| `desiredSalary` | `string \| null`    | Optional — user-entered target salary (max 100 chars); not parsed from URLs       |
| `fullJd`        | `string \| null`    | Parsed job description — cleaned minimal HTML                                     |
| `status`        | `ApplicationStatus` | `"applied" \| "interviewing" \| "rejected" \| "offer"` — defaults to `"applied"`  |
| `createdAt`     | `string`            | ISO timestamp                                                                     |
| `updatedAt`     | `string`            | ISO timestamp                                                                     |

**SQLite column mapping:** snake_case in DB (`linkedin_url`, `applied_at`, `salary_range`, `desired_salary`, `full_jd`, etc.); camelCase in TypeScript via `rowToApplication()`.

**List order:** `updated_at DESC, created_at DESC` (main application cards; application saves bump `updated_at`).

### `ApplicationNote` (`src/types.ts`)

Many notes per application, stored in `application_notes` (not on the application form).

| Field           | Type     | Notes                                      |
| --------------- | -------- | ------------------------------------------ |
| `id`            | `string` | UUID                                       |
| `applicationId` | `string` | FK → `applications.id` (cascade on delete) |
| `content`       | `string` | Note body                                  |
| `createdAt`     | `string` | ISO timestamp                              |

Repository: `getNoteRepository()` in `src/lib/server/db.ts` (`create`, `listByApplicationId`, `deleteForApplication`). Notes are managed in `ApplicationDetailSheet` (add/list/delete).

Legacy `applications.notes` values are migrated into `application_notes` on startup.

### Schema migrations

- `src/lib/server/db/schema.sql` — `CREATE TABLE IF NOT EXISTS` + index
- `src/lib/server/db/migrate.ts` — runs schema on startup; includes legacy `ALTER TABLE` for `full_jd`, `salary_range`, and `desired_salary` if missing
- Add new columns via `migrate.ts` (check `PRAGMA table_info`) — do not rely on ALTER in schema.sql alone for existing DBs

---

## REST API

All endpoints return JSON unless noted. Errors: `{ "error": "message" }` with 4xx status.

| Method   | Path                                  | Body                                          | Response                                             |
| -------- | ------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `GET`    | `/api/applications`                   | —                                             | `JobApplication[]`                                   |
| `POST`   | `/api/applications/bulk`              | `{ "ids"?: string[] }` (omit or `[]` for all) | `{ applications: JobApplication[] }`                 |
| `POST`   | `/api/applications`                   | `CreateJobApplicationInput`                   | `JobApplication` (201)                               |
| `PATCH`  | `/api/applications/:id`               | `Partial<CreateJobApplicationInput>`          | `JobApplication` or 404                              |
| `DELETE` | `/api/applications/:id`               | —                                             | 204 or 404                                           |
| `GET`    | `/api/applications/:id/notes`         | —                                             | `ApplicationNote[]`                                  |
| `POST`   | `/api/applications/:id/notes`         | `{ "content": string }`                       | `ApplicationNote` (201)                              |
| `PATCH`  | `/api/applications/:id/notes/:noteId` | `{ "content": string }`                       | `ApplicationNote` or 404                             |
| `DELETE` | `/api/applications/:id/notes/:noteId` | —                                             | 204 or 404                                           |
| `POST`   | `/api/jobs/parse`                     | `{ "url": string }`                           | `ParseJobUrlResult`                                  |
| `GET`    | `/api/admin/agent-tokens`             | —                                             | `{ tokens, envTokenConfigured, envTokenRegistered }` |
| `POST`   | `/api/admin/agent-tokens`             | `{ "name": string }`                          | `CreateAgentApiTokenResult` (201)                    |
| `POST`   | `/api/admin/agent-tokens/from-env`    | `{ "name": string }`                          | `{ record: AgentApiTokenSummary }` (201)             |
| `PATCH`  | `/api/admin/agent-tokens/:id`         | `{ "name": string }`                          | `AgentApiTokenSummary` or 404                        |
| `DELETE` | `/api/admin/agent-tokens/:id`         | —                                             | 204 or 404                                           |

**Create validation** (`src/lib/schemas/application.ts` via Zod): `url`, `title`, `company`, `appliedAt` required; optional fields (`salaryRange`, `desiredSalary`, recruiter/contact, etc.) sanitized on persist.

**Bulk fetch:** `POST /api/applications/bulk` returns full `JobApplication` records (including `salaryRange` and `desiredSalary`). The client hydrates the list via `bulkFetchApplications()` in `src/api.ts`.

**Parse response:**

```ts
// success
{ ok: true, title: string | null, company: string | null, salaryRange: string | null, fullJd: string | null }
// failure
{ ok: false, error: string }
```

Client helpers live in `src/api.ts`. Throws `Error` with server message on non-OK responses.

Route handlers set `export const runtime = "nodejs"` because `better-sqlite3` requires the Node.js runtime.

---

## Frontend

### Main UI flow (`src/app/page.tsx`)

Client component (`"use client"`). Contains the full application UI:

1. **List view** — cards sorted by server; empty state with CTA
2. **Add/Edit** — Shadcn `Dialog` with `ApplicationFormFields`
3. **Parse** — "Parse" button on URL field (and auto-parse on URL paste in the add dialog) calls `/api/jobs/parse`; fills `title`, `company`, `salaryRange`, and `fullJd` in form state (`fullJd` not shown as editable field; `salaryRange` and `desiredSalary` are editable in `ApplicationFormFields`)
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
- Add components: `pnpm dlx shadcn@latest add <component>`
- **ESLint ignores `src/components/ui/**`\*\* — don't hand-edit lint rules for generated files
- Installed: alert, badge, button, card, checkbox, dialog, field, input, input-group, label, separator, sonner, textarea

### Path alias

`@/*` → `src/*` (configured in `tsconfig.json`)

---

## Server Services

### Job URL parsing (`src/lib/server/services/parseJobUrl.ts`)

1. Validates URL (http/https only)
2. Fetches with 8s timeout, browser User-Agent
3. Parses HTML with linkedom
4. **Title:** `og:title` → `<title>` → first `<h1>`
5. **Company:** `og:site_name` → `application-name` meta → hostname heuristic
6. **salaryRange:** delegated to `extractJobSalary.ts` (JSON-LD `baseSalary`, embedded `salaryRange` JSON, labeled page text); truncated to 100 chars before persist
7. **fullJd:** delegated to `extractFullJd.ts`

### Salary extraction (`src/lib/server/services/extractJobSalary.ts`)

- Tries JSON-LD `JobPosting.baseSalary`, embedded job JSON (`salaryRange`), then labeled text (`Salary range:`, `Pay range:`, etc.)
- Returns `{ salaryRange: string | null }`; `desiredSalary` is never inferred from postings

### JD extraction (`src/lib/server/services/extractFullJd.ts`)

- Finds description root via CSS selectors (`job-description`, `article`, `main`, etc.)
- Strips to allowed tags: `p`, `ul`, `ol`, `li`, `h2`–`h4`, `strong`, `em`, `br`
- Removes attributes, boilerplate (EEO, privacy, etc.), deduplicates blocks
- Prepends `<strong>Summary</strong>` from first sentences when available
- Returns `null` if nothing useful extracted

---

## Logging

Local structured logs go to `data/logs/` (gitignored, rotated by size). Rotated files use the `applied.log.N` pattern; the active file is symlinked at `data/logs/current.log`.

Tail logs with `pnpm logs:tail` (`scripts/logs-tail.sh`). The script runs `scripts/ensure-log-file.ts` first to create the log directory and symlink when logging is enabled, then tails `current.log` (falls back to `applied.log`, or waits if the dev server has not written yet). Exits with a message when `LOG_ENABLED=false`.

| Level | Use for                                                                |
| ----- | ---------------------------------------------------------------------- |
| debug | Internal steps (parse extraction, transfer verification detail)        |
| info  | Completed operations (CRUD, backup, sync, DB ready)                    |
| warn  | Handled problems (parse failure, agent auth rejected, verify mismatch) |
| error | Failures and uncaught route errors                                     |

Server code uses `log.*` from `@/lib/server/logging/logger` — not `console.*`. Do not log validation `400`s, expected `403`s, or `404`s. Use `hostFromUrl()` instead of full job URLs. The logger initializes lazily on the first write (or when `ensure-log-file.ts` / `initLogger()` runs). Set `LOG_ENABLED=false` on Vercel until remote shipping exists.

---

## Testing

| Command             | What it runs                      |
| ------------------- | --------------------------------- |
| `pnpm test`         | Watch mode — `tests/**/*.test.ts` |
| `pnpm run test:run` | Single run for Vitest tests       |
| `pnpm run check`    | Full gate before shipping         |

**Test files:**

- `tests/applicationForm.test.ts` — form validation
- `tests/parseJobUrl.test.ts` — parse service (mocked fetch)
- `tests/extractFullJd.test.ts` — JD HTML sanitization
- `tests/sqliteRepository.test.ts` — full CRUD lifecycle (better-sqlite3 in-memory)
- `tests/logger.test.ts` — log levels, rotation, disabled mode
- `tests/loggerSymlink.test.ts` — `current.log` symlink behavior
- `tests/loggingSanitize.test.ts` — `hostFromUrl()` and error serialization

---

## Git: Branches, Commits, and PRs

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) for **all** commit messages (and branch/PR titles when used).

**Default workflow:** commit and push directly to `main`. Use a feature branch or PR only when the user creates one, asks for a branch, or asks for a PR.

### Branch names

When a feature branch is needed, use the commit type as a prefix, then a short kebab-case slug:

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

| Type       | When to use                         |
| ---------- | ----------------------------------- |
| `feat`     | New user-facing capability          |
| `fix`      | Bug fix                             |
| `docs`     | Documentation only                  |
| `refactor` | Code change without behavior change |
| `test`     | Tests only                          |
| `chore`    | Tooling, deps, housekeeping         |
| `ci`       | CI/CD changes                       |
| `perf`     | Performance improvement             |

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
- **Prettier** — run `pnpm run format` before commit; Tailwind class sorting via plugin
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

|           | Development                                                  | Production                                                                  |
| --------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Server    | `pnpm dev` (Next.js HMR)                                     | `pnpm run build` + `pnpm start`                                             |
| API       | Same Next.js process                                         | Same Next.js process                                                        |
| API calls | Same-origin `/api`                                           | Same-origin `/api`                                                          |
| Database  | `DATABASE_PROVIDER=sqlite` with `data/applied.db` by default | Local file SQLite for self-hosted Node; `DATABASE_PROVIDER=turso` on Vercel |

**Vercel database settings:**

- Set `DATABASE_PROVIDER=turso`.
- Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- Do not use `DATABASE_PROVIDER=sqlite` on Vercel for writable production data; Vercel's local filesystem is ephemeral.
- The app uses one selected provider per process. It does not dual-write, use embedded replicas, or automatically sync local SQLite with Turso.

---

## Learned Workspace Facts

- Applied.dev is a single-page job application tracker; main client UI lives in `src/components/AppPage.tsx` (header/tab title `APPLIED.`; clickable logo `resetToHome` clears filters and page; `ThemeToggle`, icon-only `AdminDialog` for backup/export, Copy All URLs, and agent token management; server-hydrated initial data via `loadInitialPageData()` in `page.tsx` — applications, notes, and `salaryRange`/`desiredSalary`; `force-dynamic`; page size from cookie for SSR, synced from `localStorage`; `ApplicationFilters` for company/status/search via `filterApplications` (search includes salary fields); card pagination via `ApplicationCardPagination`/`applicationPagination`; list footer with `hello@swoo.io` and MIT License link to GitHub; notes seeded in `useApplicationNotesCache` from server hydration; clipboard-only URL prefill on new-application open with parse filling `salaryRange` when found)
- Stack: Next.js App Router, Node.js, pnpm, strict TypeScript, React, Tailwind CSS, Shadcn UI, self-hosted Roboto Mono
- `pnpm dev` runs `scripts/dev-clean.sh` (wipes `.next`, reads `PORT` from `.env.local`, then starts Turbopack on port 3030 by default)
- Required application form fields: job posting URL, title, company, apply date; all other fields are optional
- Parsed job postings store cleaned minimal HTML in `full_jd`; user notes live in `application_notes` (many per application)
- Database persistence is selected by `DATABASE_PROVIDER`: local SQLite via better-sqlite3 (`data/applied.db` by default) or Turso Cloud via `@tursodatabase/serverless`; runtime uses exactly one provider per process
- API request bodies are validated with Zod and sanitized before persistence
- Job URL parse uses `extractJobCompany` and `extractParaformRole`: Y Combinator, Ashby, and Paraform are job boards, not employers; Paraform title/company from JSON-LD, Next data, and og:title patterns; `normalizeJobTitle()` strips `| Y Combinator` and anything after it, and collapses extra whitespace on parse/save
- Application statuses: `applied`, `to_apply`, `interviewing`, `waiting`, `rejected`, `offer`, `passed` — managed via `ApplicationStatusPicker` on cards and in the detail drawer; status changes auto-create a note `Status Update: {label}` via PATCH; agent API creates use `to_apply` (label "To Apply")
- `ApplicationDetailSheet` is 60vw, slides from the right with blurred backdrop; detail form `Separator`s are full-width siblings between `DetailSection` blocks with `px-6` (not `-mx` bleed inside `overflow-y-auto`); note create/patch/delete bumps parent `updatedAt` via `touchApplicationUpdatedAt` so cards re-sort; theme via `ThemeProvider` + blocking `themeInitScript()` before paint (near-black dark tokens in `styles.css`); Sonner follows active theme
- Backup/export: `GET /api/backup/export?format=sql|json` and `POST /api/backup/import` (multipart `file`, `mode` `replace`|`upsert`); logic in `backupService.ts`; JSON backups use `version: 1`; provider-selected database backup via `GET /api/backup/database` (local SQLite returns a zipped `.db`; Turso returns a zipped SQL backup); `AdminDialog` "Create Backup" downloads `.zip`; when running local SQLite with Turso env configured, `AdminDialog` also offers "Turso Sync" via `POST /api/backup/sync-turso` (CLI: `pnpm db:push-turso`, `pnpm db:pull-turso`, `pnpm db:verify-turso`); backups intentionally exclude agent API tokens and app access tokens
- Agent API tokens: create/list/revoke/rename in `AdminDialog`; raw token shown once at creation; `lastUsedAt` updated on successful DB-token auth; optional `AGENT_API_TOKEN` env bootstrap can be registered in DB via Admin; `pnpm agent:token` prints env-bootstrap only
- Local logging: pino → `data/logs/` with size rotation; active symlink `current.log`; levels debug/info/warn/error; `pnpm logs:tail` runs `ensure-log-file.ts` then tails (creates log dir if missing); disabled in Vitest by default unless `LOG_ENABLED=true`; use `LOG_ENABLED=false` on Vercel
- Optional salary fields: `salaryRange` (posting pay range, parsed on job URL fetch) and `desiredSalary` (user target, form-only); both optional on create/patch, searchable, included in backup/export JSON and SQL
- Deployable to Vercel with Turso Cloud (`DATABASE_PROVIDER=turso`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`); app access via `APP_ACCESS_TOKEN` with session login for browser and Bearer auth for scripts (`pnpm app:token`); agent API accepts DB-managed tokens (preferred) or optional env bootstrap `AGENT_API_TOKEN` (`pnpm agent:token` prints env-only); Electron is a viable desktop path with local SQLite (no hosted DB required); external-agent workflow via token-protected `/api/agent` (GET discovery is public; GET/POST `/api/agent/applications` for list/create only; list accepts optional `?search=` on title, company, status, status label, URL, and applied date via `filterAgentApplicationsBySearch` in `applicationSearch.ts`); agent create-from-URL persists parsed `salaryRange` when the parser finds it; agent docs in `LEARNING_PROMPT.md`
