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

## Completed Foundations

- Minimal agent HTTP API with bearer-token authentication.
- Agent-created applications use the `to_apply` status.
- Existing browser workflow remains unchanged.
