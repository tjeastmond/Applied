# Roadmap

## Planned Features

### Agent API Token Management

- Store agent API tokens in the database as hashed values instead of relying on a single `AGENT_API_TOKEN` environment variable.
- Add CLI support for creating, listing, and revoking named agent tokens.
- Keep generated token values visible only at creation time.
- Preserve the current limited agent permissions: discover, list applications, and create applications from job URLs only.

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
