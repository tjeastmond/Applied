# Roadmap

## Planned Features

### App Access Token Management In Admin

- Add an Admin section for the browser app access token (`app_access_config` / `APP_ACCESS_TOKEN`).
- Show whether the token comes from the environment or the database (same hydration pattern as today).
- Support viewing the token prefix or metadata and rotating/regenerating with a one-time reveal.
- Keep agent API tokens separate — app login does not count toward the agent token limit.
- Document rotation in `AGENTS.md` and `.env.example`; exclude app access tokens from backups (existing policy).

### User Accounts And Email Login

- Add users with email addresses and password-based login.
- Store passwords securely using a strong password hashing algorithm.
- Add session management for authenticated browser access.
- Scope application data to authenticated users once accounts exist.
- Keep a migration path for the current single-user local database.

### Log Tracing And Tracking

- Adopt a structured logging and tracing stack with request correlation across API routes and server services.
- Add end-to-end visibility for slow or failure-prone paths (job URL parse, database operations, backup/import, agent API).
- Make production logs searchable and actionable on Vercel/Turso deployments.

## Completed Foundations

- Local and Turso data transfer CLI (`pnpm db:push-turso`, `pnpm db:pull-turso`, `pnpm db:verify-turso`).
- Minimal agent HTTP API with bearer-token authentication.
- Agent-created applications use the `to_apply` status.
- Existing browser workflow remains unchanged.
- DB-hashed agent API tokens with Admin UI create/list/revoke/rename, one-time reveal, env registration, and `last_used_at` tracking.
- `pnpm agent:token` remains an env-bootstrap generator; token management lives in Admin.
