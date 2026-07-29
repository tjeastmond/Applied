# Applied.dev Agent CLI and API Learning Prompt

You have access to the Applied.dev Agent API and CLI.

**Recommended:** use the CLI from the applied.dev repo with the dev server already running. Do not run `pnpm run check` or `pnpm dev` for agent writes.

```bash
pnpm applied:agent applications add --url "https://example.com/job-posting"
pnpm applied:agent applications list --search engineer
pnpm applied:agent companies list
pnpm applied:agent applications set-status --id <uuid> --status applied
pnpm applied:agent applications add-note --id <uuid> --content "Follow up next week"
pnpm applied:agent docs
```

Environment (from `.env.local`):

- `AGENT_API_TOKEN` — **required** on every CLI invocation and HTTP request
- `APPLIED_DEV_URL` — default `http://localhost:3030`

## Authentication

**All** agent endpoints require bearer-token authentication. There are no public agent routes.

```
Authorization: Bearer <AGENT_API_TOKEN>
```

Authentication setup:

- Preferred: sign in to the app → Admin → Agent API Tokens → create a named token → copy it immediately
- Bootstrap: `pnpm agent:token` prints `AGENT_API_TOKEN=...` for `.env.local`; restart the dev server; register it in Admin to manage/revoke from the UI
- Deployed hosts: DB tokens persist on Turso; `AGENT_API_TOKEN` env still works additively on Vercel
- Do not use `APP_ACCESS_TOKEN` for agent endpoints
- If no agent token is configured (no env token and no active DB tokens), endpoints return 503

## Documentation URLs

Fetch with the same bearer token:

- `GET /api/agent/docs` — markdown reference (CLI commands, endpoints, statuses, rules)
- `GET /api/agent` — JSON discovery document (capabilities, limitations, CLI examples)

## CLI commands

```
pnpm applied:agent applications list [--search QUERY] [--json]
pnpm applied:agent applications add --url URL [--status STATUS] [--json]
pnpm applied:agent applications get --id ID [--json]
pnpm applied:agent applications set-status --id ID --status STATUS [--json]
pnpm applied:agent applications add-note --id ID --content "..." [--json]
pnpm applied:agent companies list [--search QUERY] [--json]
pnpm applied:agent posts add --url URL [--status STATUS] [--json]
pnpm applied:agent docs [--json]
```

Status aliases: `apply`, `to-apply`, `to_apply` → `to_apply`

Default status on create: `to_apply` ("To Apply")

## HTTP endpoints

| Method | Path                                | Purpose                                  |
| ------ | ----------------------------------- | ---------------------------------------- |
| GET    | `/api/agent`                        | JSON discovery                           |
| GET    | `/api/agent/docs`                   | Markdown reference                       |
| GET    | `/api/agent/applications`           | List applications (`?search=`)           |
| POST   | `/api/agent/applications`           | Create from job URL (`{ url, status? }`) |
| GET    | `/api/agent/applications/:id`       | Get one application                      |
| PATCH  | `/api/agent/applications/:id`       | Update status only (`{ status }`)        |
| GET    | `/api/agent/applications/:id/notes` | List notes                               |
| POST   | `/api/agent/applications/:id/notes` | Add note (`{ content }`)                 |
| GET    | `/api/agent/companies`              | Distinct companies (`?search=`)          |

Status values: `applied`, `to_apply`, `interviewing`, `waiting`, `no_response`, `rejected`, `offer`, `passed`

## Rules

- Add applications one at a time from job URLs
- Default status is `to_apply`; pass `--status` or `{ "status": "..." }` to override
- Status changes create an automatic status-update note, a "Updated by the CLI" audit note, and a history entry
- Creating an application adds a "Created by the CLI" audit note; explicit `add-note` does not add an extra audit note
- Archived applications are hidden from list, company, and get-by-id responses
- If creating from a URL fails because title or company cannot be parsed, report the failure — do not invent data
- Do not access backups, imports, user management, or unrelated app routes
- Errors use `{ "error": "message" }` with HTTP 400, 401, 404, or 503

When using HTTP directly, start with `GET /api/agent/docs` or `GET /api/agent`, then use only documented agent endpoints.
