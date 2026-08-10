# Applied.dev Agent CLI and API Learning Prompt

You have access to the Applied.dev Agent API and CLI.

**Recommended:** use the agent CLI against any running Applied.dev host (local or deployed). The CLI is a plain HTTP client — your shell cwd does not need to be the repo.

```bash
# Local dev (default base URL http://localhost:3030)
applied-agent applications list

# Production on Vercel
export APPLIED_DEV_URL='https://your-app.vercel.app'
export AGENT_API_TOKEN='your-token'
applied-agent applications add --url "https://example.com/job"
```

Install globally once from the repo: `pnpm build:cli && pnpm setup && pnpm add -g .` (or symlink `bin/applied-agent.js`). From inside the repo you can also use `pnpm applied:agent`.

Do not run `pnpm run check` or `pnpm dev` for agent writes — only the server must be running (local or remote).

## Environment

Precedence (highest first): `--token` / `--base-url` → shell exports (e.g. `~/.zshrc`) → `APPLIED_DEV_DIR` checkout `.env.local` → cwd `.env.local` → defaults.

- `AGENT_API_TOKEN` — **required** on every CLI invocation and HTTP request
- `APPLIED_DEV_URL` — target host (default `http://localhost:3030`; set to your Vercel URL for production)
- `APPLIED_DEV_DIR` — optional; fill in keys not already exported from that checkout's `.env.local`

Or pass per invocation: `--token`, `--base-url`

## Authentication

**All** agent endpoints require bearer-token authentication. The OpenAPI document at `GET /api/agent/openapi` is public (no token). Interactive docs: `/agent/docs`.

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

Fetch markdown and discovery with the same bearer token:

- `GET /api/agent/docs` — markdown reference (CLI commands, endpoints, statuses, rules)
- `GET /api/agent` — JSON discovery document (capabilities, limitations, CLI examples)

Public (no token):

- `GET /api/agent/openapi` — OpenAPI 3.1 JSON spec
- `/agent/docs` — interactive Scalar API reference

## CLI commands

```
applied-agent applications list [--search QUERY] [--json]
applied-agent applications add --url URL [--status STATUS] [--json]
applied-agent applications get --id ID [--json]
applied-agent applications set-status --id ID --status STATUS [--json]
applied-agent applications add-note --id ID --content "..." [--json]
applied-agent companies list [--search QUERY] [--json]
applied-agent posts add --url URL [--status STATUS] [--json]
applied-agent docs [--json]
```

From the repo only: prefix with `pnpm applied:agent` instead of `applied-agent`.

Status aliases: `apply`, `to-apply`, `to_apply` → `to_apply`

Default status on create: `to_apply` ("To Apply")

## HTTP endpoints

| Method | Path                                | Purpose                                  |
| ------ | ----------------------------------- | ---------------------------------------- |
| GET    | `/api/agent/openapi`                | OpenAPI 3.1 spec (public)                |
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

When using HTTP directly, start with `GET /api/agent/openapi`, `GET /api/agent/docs`, or `GET /api/agent`, then use only documented agent endpoints.
