# Session Handoff — Admin Modal & Agent Token Management

**Branch:** `main`  
**Commit:** `75d508a` — `feat(admin): add modal for backup export and agent token management`  
**Date:** 2026-06-17

---

## Summary

This session replaced the header **Backup** dropdown with an **Admin** modal and shipped the first version of **named agent API token management** (create, list, revoke). Backup/export actions, Turso sync, and **Copy All URLs** now live inside the modal. Agent auth accepts either a bootstrap `AGENT_API_TOKEN` env var or any active token stored in the database.

---

## Work Completed

### Admin UI

| Item          | Details                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Entry point   | Settings icon in header (`AdminDialog`) replaces `BackupMenu`                                                            |
| Layout        | `sm:max-w-4xl` modal; full-bleed `Separator` dividers between sections (edge-to-edge, no horizontal padding on dividers) |
| Sections      | Header → Backup & Export → Copy All URLs → Agent API Tokens                                                              |
| Backup row    | Export SQL, Export JSON, Create Backup, Import Backup, Turso Sync (when available) on one `flex-nowrap` row              |
| Copy All URLs | Moved from header; description: _"Copy the job posting URLs for every application you've applied to."_                   |
| Import flow   | Extracted to `BackupImportDialog.tsx` (evolved from `BackupMenu.tsx`)                                                    |

**Key files**

- `src/components/AdminDialog.tsx`
- `src/components/BackupImportDialog.tsx`
- `src/components/AuthenticatedApp.tsx` (header wiring; `applications` passed into admin modal)

### Agent token data layer

| Item         | Details                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Table        | `agent_api_tokens` in `src/lib/server/db/schema.sql`                                                           |
| Columns      | `id`, `name`, `token_hash` (SHA-256), `token_prefix` (first 8 chars), `created_at`, `revoked_at` (soft delete) |
| Repositories | `SqliteAgentApiTokenRepository`, `TursoAgentApiTokenRepository`                                                |
| Wiring       | `DatabaseBackend.agentApiTokens`, `getAgentApiTokenRepository()` in `src/lib/server/db.ts`                     |

**Key files**

- `src/lib/server/repositories/agentApiTokenRepository.ts`
- `src/lib/server/db/sqliteAgentApiTokenRepository.ts`
- `src/lib/server/db/tursoAgentApiTokenRepository.ts`
- `src/lib/server/hashAgentToken.ts`
- `src/lib/server/generateAccessToken.ts` (reused for raw token generation)

### Agent token API

All routes require **app session** auth (`requireAppAccess`), not agent auth.

| Method   | Path                          | Purpose                                            |
| -------- | ----------------------------- | -------------------------------------------------- |
| `GET`    | `/api/admin/agent-tokens`     | List active tokens + `envTokenConfigured: boolean` |
| `POST`   | `/api/admin/agent-tokens`     | Create token `{ name }` → returns raw token once   |
| `DELETE` | `/api/admin/agent-tokens/:id` | Soft-revoke token                                  |

**Key files**

- `src/app/api/admin/agent-tokens/route.ts`
- `src/app/api/admin/agent-tokens/[id]/route.ts`
- `src/lib/schemas/agentToken.ts`
- `src/api.ts` — `listAgentTokens()`, `createAgentToken()`, `revokeAgentToken()`

### Agent auth changes

`requireAgentAuth` is now **async** and checks:

1. At least one source configured (env token **or** active DB tokens) — else `503`
2. Bearer matches `AGENT_API_TOKEN` env — authorized
3. Bearer matches any active DB token hash — authorized
4. Otherwise — `401`

**Key files**

- `src/lib/server/agentAuth.ts`
- `src/lib/server/agentEnvToken.ts`
- `src/app/api/agent/applications/route.ts` (awaits `requireAgentAuth`)
- `src/app/api/agent/route.ts` (discovery text updated for UI-managed tokens)

### Admin token UI behavior

- Create: name input + green **Create Token** button
- One-time reveal card with **Copy Token** (raw value never stored or re-fetched)
- List: name, prefix (`abcd1234…`), created date, revoke (with `AlertDialog`)
- Banner when `AGENT_API_TOKEN` env is set: env token is active but not listed/revocable in UI
- Revoke warning when removing the last DB token and no env token is configured

### Tests

| File                                    | Coverage                                  |
| --------------------------------------- | ----------------------------------------- |
| `tests/agentApiTokenRepository.test.ts` | Create, list, validate, revoke            |
| `tests/adminAgentTokenRoutes.test.ts`   | CRUD, app-auth gate, `envTokenConfigured` |
| `tests/agentApiRoutes.test.ts`          | DB token auth, `503` when unconfigured    |

All tests pass; `tsc --noEmit` clean at commit time.

### Toast messages

Added in `src/lib/toastMessages.ts`: `agentTokenCreated`, `agentTokenCreateFailed`, `agentTokenRevoked`, `agentTokenRevokeFailed`, `agentTokensLoadFailed`, `agentTokenCopied`, `agentTokenCopyFailed`.

---

## How to Use (Current State)

1. Sign in to the app (app access token / dev login).
2. Open **Admin** (settings icon in header).
3. Under **Agent API Tokens**, enter a name and click **Create Token**.
4. Copy the token immediately — it is not shown again.
5. Call agent API with `Authorization: Bearer <token>` on `/api/agent/applications`.

**Bootstrap option:** `AGENT_API_TOKEN` in `.env.local` still works and is additive. It does not appear in the admin list and cannot be revoked from the UI.

**CLI:** `pnpm agent:token` prints an env-style bootstrap token with stderr guidance — not wired to the DB; use Admin for named tokens.

---

## Remaining Work — Token Management

### High priority

- [x] **Docs sync** — Update `AGENTS.md`, `LEARNING_PROMPT.md`, and `.env.example` to describe Admin UI token creation as the preferred path; clarify env token as optional bootstrap.
- [x] **`pnpm agent:token` alignment** — Documented as env-bootstrap only; stderr points users to Admin modal.
- [x] **Turso integration test** — `tests/tursoBackend.test.ts` covers `TursoAgentApiTokenRepository` CRUD (opt-in via `TURSO_TEST_DATABASE_URL` / `TURSO_TEST_AUTH_TOKEN`).

### Medium priority

- [x] **Backup export includes tokens** — **Cancelled.** Backups intentionally exclude agent tokens from JSON, SQL, and SQLite zip exports.
- [x] **Import restore behavior** — **N/A** — follows from exclusion policy; re-create tokens after restore.
- [x] **Env → DB migration helper** — `POST /api/admin/agent-tokens/from-env` + Admin "Register in Database" button.
- [x] **`last_used_at`** — Column migration, auth touch, Admin list sorting/display.
- [x] **Rename token** — `PATCH /api/admin/agent-tokens/:id` + inline rename in Admin.

### Lower priority / future

- [ ] **Per-token scopes** — Restrict tokens to specific agent capabilities (list-only vs create, etc.).
- [ ] **App access token in Admin** — Separate section to view/rotate the browser app token (mirrors `app_access_config`); out of scope for this session.
- [ ] **Token count limits** — Cap active tokens or warn before creating many.
- [ ] **Unique token names** — Currently duplicate names are allowed; enforce uniqueness if desired.
- [ ] **Agent discovery polish** — `GET /api/agent` could expose `tokenSource: "env" | "database" | "both"` based on live configuration.

### Known gaps / edge cases

| Gap                          | Notes                                                               |
| ---------------------------- | ------------------------------------------------------------------- |
| Revoke last DB token, no env | Agent API returns `503`; UI warns in revoke dialog                  |
| Revealed token dismissed     | User must copy at create time; no recovery path                     |
| Env token invisible in UI    | Register via Admin when env configured but not yet in DB            |
| JSON/SQL/SQLite zip backup   | Agent tokens excluded by policy (app access tokens too)             |
| `AGENT_API_TOKEN` on Vercel  | Still valid; DB tokens work on Turso when `DATABASE_PROVIDER=turso` |

---

## Suggested Next Session Order

1. Update docs (`AGENTS.md`, `LEARNING_PROMPT.md`, `.env.example`).
2. Decide fate of `pnpm agent:token` (wire to DB or mark deprecated).
3. Add Turso repository test.
4. Plan backup v2 if token restore matters for disaster recovery.

---

## File Map (Quick Reference)

```
src/components/AdminDialog.tsx          # Admin modal (backup, copy URLs, tokens)
src/components/BackupImportDialog.tsx   # Import sub-dialog
src/app/api/admin/agent-tokens/         # Admin token CRUD
src/lib/server/agentAuth.ts             # Env + DB bearer validation
src/lib/server/db/schema.sql            # agent_api_tokens DDL
src/lib/server/db/sqliteAgentApiTokenRepository.ts
src/lib/server/db/tursoAgentApiTokenRepository.ts
tests/agentApiTokenRepository.test.ts
tests/adminAgentTokenRoutes.test.ts
tests/agentApiRoutes.test.ts              # Updated for DB token auth
```

**Removed:** `src/components/BackupMenu.tsx` (replaced by Admin + BackupImportDialog)
