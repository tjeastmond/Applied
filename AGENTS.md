# Applied.dev — Agent Guide

Single-page job application tracker. Users add/edit applications in a modal, parse job posting URLs for title/company/description, and browse saved applications as cards.

---

## Learned User Preferences

- Use Shadcn UI for frontend components
- Show status feedback with Sonner toasts in the top-right corner; success toasts pastel green with darker green border, errors red — not inline alert banners
- Add applications in a Shadcn Dialog modal; view/edit in `ApplicationDetailSheet` (card click): status saves immediately in the sheet (same path as cards; `isManualSaveFormDirty` excludes status from unsaved-close prompt); notes default newest-first with sort picker (newest/oldest, persisted in `localStorage` as `applied-dev-note-sort`), linkify http(s) URLs in note body with long URLs truncated inside the border, edit/copy/delete on note date row (muted ghost icons; inline textarea with Save Note / Cancel when editing), green-styled Add Note save; unsaved edits show Alert Dialog on close (Save Now, Don't Save with `warnOutline`, Cancel keeps editing); Cmd/Ctrl+S saves dirty fields and prevents browser save (info toast "No changes." when clean); Cmd/Ctrl+Enter saves a new or edited note; Escape cancels note edit
- Cmd+K (Mac) / Ctrl+K (Windows) opens the new application modal
- Save/submit buttons green and title case; Cancel uses `cancelOutline` (red border, transparent background, light red tint on hover) in modals and sheets
- Form inputs: blue border on focus without a gray focus ring; red border (`aria-invalid`) on required fields left empty after a failed submit; date inputs use a muted calendar picker icon; list filters in `ApplicationFilters`: search above equal-width company/status multi-selects with fixed trigger widths, animated chevrons, and no layout shift when menus open; always-visible clear-filters icon button (pale red background and white X when active, muted X when disabled, border unchanged when active; `cursor-not-allowed` on wrapper when inactive); double-tap Escape clears filters on card view; `/` focuses search when sheet closed and no field focused; `Separator` below the filter block; keep controls `h-8` via `FILTER_CONTROL_HEIGHT_CLASS` in `src/lib/filterControls.ts`
- Add-application dialog: hide notes (manage in detail drawer); no section dividers; recruiter/contact fields optional by default; auto-parse on URL paste; on open, clipboard-only URL prefill, parse, then focus Save Application
- Label the field "Company LinkedIn URL"; use "Contact Name" for the recruiter name field; when `linkedinUrl` is set, show a LinkedIn link before Job Description on cards and sheet via `ApplicationMetadataLine`
- Use Shadcn Alert Dialog for delete confirmations, not `window.confirm`; no edit/delete on application cards — delete only from the detail drawer
- Application cards use color-coded `ApplicationStatusPicker` (tag-like dropdown, closes on select; Applied first, then alphabetical); job URLs via `JobDescriptionLink` with copy icon; drawer overlay blurs background; header has icon-only `BackupMenu` (database icon), Copy All URLs, and Add Application
- Light/dark theme toggle in header (Lucide Sun/Moon); persist choice in `localStorage` (`applied-dev-theme`); default light; dark-mode header toolbar outline buttons use `header-toolbar-outline` in `styles.css` for lighter borders and visible hover
- Links: no default underline; left-to-right underline animates on hover/focus for `a[href]`; sheet header job title uses `link-plain` plus `ExternalLinkIcon` (no animated underline)

---

## Quick Start

```bash
pnpm install         # install dependencies
pnpm dev             # Next.js dev server with Turbopack (port 3000)
pnpm dev:clean       # wipe .next and start dev (if HMR/CSS breaks)
pnpm run check       # typecheck + tests + lint + format + build (full CI gate)
```

**Production:**

```bash
pnpm run build       # next build
pnpm run start       # next start (production server)
```

**Environment variables:**

| Variable        | Default           | Purpose                          |
| --------------- | ----------------- | -------------------------------- |
| `DATABASE_PATH` | `data/applied.db` | SQLite file path                 |
| `NODE_ENV`      | —                 | `production` for optimized build |
| `PORT`          | `3000`            | HTTP port for `next start`       |

---

## Stack

| Layer        | Technology                                                               |
| ------------ | ------------------------------------------------------------------------ |
| Runtime      | Node.js                                                                  |
| Package mgr  | pnpm                                                                     |
| Framework    | Next.js 15 (App Router)                                                  |
| Frontend     | React 19, TypeScript (strict)                                            |
| Styling      | Tailwind CSS 4, Shadcn UI (`base-nova` style), Roboto Mono (self-hosted) |
| Icons        | Lucide React                                                             |
| Toasts       | Sonner (`<Toaster />` in `src/app/layout.tsx`)                           |
| Backend      | Next.js Route Handlers (`src/app/api/**`)                                |
| Database     | SQLite via `better-sqlite3`                                              |
| HTML parsing | linkedom (server-side job URL fetch + parse)                             |
| Tests        | Vitest (unit + SQLite integration)                                       |
| Lint/format  | ESLint 9 (type-checked), Prettier + tailwind plugin                      |

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
│   │       └── services/
│   │           ├── parseJobUrl.ts  # Fetch URL, extract title/company/JD
│   │           └── extractFullJd.ts
│   └── components/ui/              # Shadcn components (do not lint)
├── tests/                          # Vitest (*.test.ts)
├── data/                           # SQLite DB (gitignored); auto-created
├── .ai/issues.md                   # Track bugs/issues found during work
├── components.json                 # Shadcn config (style: base-nova)
├── next.config.ts                  # Next.js config (externalizes better-sqlite3)
├── postcss.config.mjs              # Tailwind PostCSS
├── vitest.config.ts
└── AGENTS.md                       # This file
```

---

## Data Model

### `JobApplication` (`src/types.ts`)

| Field           | Type                | Notes                                                                            |
| --------------- | ------------------- | -------------------------------------------------------------------------------- |
| `id`            | `string`            | UUID, server-generated                                                           |
| `url`           | `string`            | **Required** — job posting URL                                                   |
| `linkedinUrl`   | `string \| null`    | Optional                                                                         |
| `title`         | `string \| null`    | **Required on create** (validated server + client)                               |
| `company`       | `string \| null`    | **Required on create**                                                           |
| `appliedAt`     | `string`            | **Required** — ISO date `YYYY-MM-DD`                                             |
| `viaRecruiter`  | `boolean`           | When false, recruiter fields cleared on save                                     |
| `recruiterName` | `string \| null`    | Only when `viaRecruiter`                                                         |
| `recruiterFirm` | `string \| null`    | Only when `viaRecruiter`                                                         |
| `contactEmail`  | `string \| null`    |                                                                                  |
| `contactPhone`  | `string \| null`    |                                                                                  |
| `fullJd`        | `string \| null`    | Parsed job description — cleaned minimal HTML                                    |
| `status`        | `ApplicationStatus` | `"applied" \| "interviewing" \| "rejected" \| "offer"` — defaults to `"applied"` |
| `createdAt`     | `string`            | ISO timestamp                                                                    |
| `updatedAt`     | `string`            | ISO timestamp                                                                    |

**SQLite column mapping:** snake_case in DB (`linkedin_url`, `applied_at`, `full_jd`, etc.); camelCase in TypeScript via `rowToApplication()`.

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
- `src/lib/server/db/migrate.ts` — runs schema on startup; includes legacy `ALTER TABLE` for `full_jd` if missing
- Add new columns via `migrate.ts` (check `PRAGMA table_info`) — do not rely on ALTER in schema.sql alone for existing DBs

---

## REST API

All endpoints return JSON unless noted. Errors: `{ "error": "message" }` with 4xx status.

| Method   | Path                                  | Body                                 | Response                 |
| -------- | ------------------------------------- | ------------------------------------ | ------------------------ |
| `GET`    | `/api/applications`                   | —                                    | `JobApplication[]`       |
| `POST`   | `/api/applications`                   | `CreateJobApplicationInput`          | `JobApplication` (201)   |
| `PATCH`  | `/api/applications/:id`               | `Partial<CreateJobApplicationInput>` | `JobApplication` or 404  |
| `DELETE` | `/api/applications/:id`               | —                                    | 204 or 404               |
| `GET`    | `/api/applications/:id/notes`         | —                                    | `ApplicationNote[]`      |
| `POST`   | `/api/applications/:id/notes`         | `{ "content": string }`              | `ApplicationNote` (201)  |
| `PATCH`  | `/api/applications/:id/notes/:noteId` | `{ "content": string }`              | `ApplicationNote` or 404 |
| `DELETE` | `/api/applications/:id/notes/:noteId` | —                                    | 204 or 404               |
| `POST`   | `/api/jobs/parse`                     | `{ "url": string }`                  | `ParseJobUrlResult`      |

**Create validation** (`src/lib/schemas/application.ts` via Zod): `url`, `title`, `company`, `appliedAt` required; optional fields sanitized on persist.

**Parse response:**

```ts
// success
{ ok: true, title: string | null, company: string | null, fullJd: string | null }
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
6. **fullJd:** delegated to `extractFullJd.ts`

### JD extraction (`src/lib/server/services/extractFullJd.ts`)

- Finds description root via CSS selectors (`job-description`, `article`, `main`, etc.)
- Strips to allowed tags: `p`, `ul`, `ol`, `li`, `h2`–`h4`, `strong`, `em`, `br`
- Removes attributes, boilerplate (EEO, privacy, etc.), deduplicates blocks
- Prepends `<strong>Summary</strong>` from first sentences when available
- Returns `null` if nothing useful extracted

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

|           | Development              | Production                      |
| --------- | ------------------------ | ------------------------------- |
| Server    | `pnpm dev` (Next.js HMR) | `pnpm run build` + `pnpm start` |
| API       | Same Next.js process     | Same Next.js process            |
| API calls | Same-origin `/api`       | Same-origin `/api`              |
| Database  | `data/applied.db`        | Same                            |

---

## Learned Workspace Facts

- Applied.dev is a single-page job application tracker; main client UI lives in `src/components/AppPage.tsx` (header/tab title `APPLIED.`; `ThemeToggle`, icon-only `BackupMenu`, Copy All URLs; `ApplicationFilters` for company/status/search via `filterApplications`; list footer with `hello@swoo.io` and MIT License link to GitHub; notes prefetched on load and sheet open through `useApplicationNotesCache`; clipboard-only URL prefill on new-application open)
- Stack: Next.js App Router, Node.js, pnpm, strict TypeScript, React, Tailwind CSS, Shadcn UI, self-hosted Roboto Mono
- `pnpm dev` runs `scripts/dev-clean.sh` (wipes `.next` then starts Turbopack on port 3000)
- Required application form fields: job posting URL, title, company, apply date; all other fields are optional
- Parsed job postings store cleaned minimal HTML in `full_jd`; user notes live in `application_notes` (many per application)
- SQLite persistence via better-sqlite3 (`data/applied.db` by default)
- API request bodies are validated with Zod and sanitized before persistence
- Job URL parse uses `extractJobCompany` and `extractParaformRole`: Y Combinator, Ashby, and Paraform are job boards, not employers; Paraform title/company from JSON-LD, Next data, and og:title patterns; `normalizeJobTitle()` strips trailing board suffixes on parse/save
- Application statuses: `applied`, `interviewing`, `waiting`, `rejected`, `offer`, `passed` — managed via `ApplicationStatusPicker` on cards and in the detail drawer; status changes auto-create a note `Status Update: {label}` via PATCH
- `ApplicationDetailSheet` is 60vw, slides from the right with blurred backdrop; theme via `ThemeProvider` + blocking `themeInitScript()` before paint (near-black dark tokens in `styles.css`); Sonner follows active theme
- Backup/export: `GET /api/backup/export?format=sql|json` and `POST /api/backup/import` (multipart `file`, `mode` `replace`|`upsert`); logic in `backupService.ts`; JSON backups use `version: 1`
- Deployable to Vercel; thin auth later; SQLite for now, Postgres possible later; Electron is a viable desktop path with local SQLite (no hosted DB required)
