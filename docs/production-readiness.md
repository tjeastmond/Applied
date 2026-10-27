# Production Readiness

Goal: host Applied.dev on a subdomain of my site, single user (me). Target stack is **Vercel + Turso**, which the code already supports (`DATABASE_PROVIDER=turso`, SQLite blocked on Vercel, dev one-click login disabled outside local SQLite dev).

Baseline as of 2026-10-27: `pnpm run check` passes (80 test files, 580 tests, lint, format, build). All `/api/*` routes are behind app or agent auth except the auth endpoints and public agent docs/OpenAPI. Job URL fetches already have SSRF guards (private-IP blocking, manual redirects with re-validation).

---

## P0 — Blockers (do before the first public deploy)

- [x] **Upgrade Next.js to ≥ 16.4.3.** _Done: next/eslint-config-next 16.4.3, zod 4.6.7, `pnpm audit --prod` clean._ `pnpm audit --prod` reports 6 critical / 40 high advisories. The Next ones include unauthenticated RCE and a Middleware/Proxy auth bypass, all fixed by 16.4.1+. Also bump `zod` to ≥ 4.6.6 (memory exhaustion on oversized collections).
- [x] **Move `shadcn` to `devDependencies`.** It's a CLI and nothing at runtime uses it, but it pulls in `@modelcontextprotocol/sdk`, `hono`, `body-parser`, etc. Most of the remaining audit findings come through it.
- [x] **Close the first-run setup hole.** _Done (a): outside local dev, setup needs the app access token (Access Token field on Create Account, or a Bearer token/session), returns 503 with no token configured, and is throttled. Still seed via (b)._ `POST /api/auth/setup` is unauthenticated and works whenever no password exists. On a fresh production database, whoever reaches it first becomes the owner and gets a session. `GET /api/auth/status` also publicly reports `setupRequired`. Fix options: (a) in production, require a valid `APP_ACCESS_TOKEN` (bearer or token paste) before setup is allowed, or (b) set the password by importing the local DB/backup into Turso before the domain goes live. Do (a) and still seed via (b).
- [x] **Rate-limit login.** _Done: DB-backed `auth_login_throttle` (SQLite + Turso) — 10 failures / 15 min per client IP, 100 / hour global, 429 + `Retry-After`; covers password, token, and setup. Still add a Vercel Firewall rate-limit rule on `/api/auth/*` as an edge layer._ `/api/auth/password-login` and `/api/auth/login` (token paste) have no attempt limiting. In-memory counters don't hold across Vercel instances, so use a Vercel Firewall rate-limit rule on `/api/auth/*`, a small Turso-backed failure counter with backoff, or both.
- [x] **Fix logging for Vercel.** _Done: JSON to stdout when `VERCEL=1` (override with `LOG_DESTINATION=file|stdout`); file mode falls back to stdout if the log dir can't be created._ With `LOG_ENABLED` unset, the logger calls `mkdirSync("data/logs")` on a read-only filesystem, which throws during init and can turn every logged route into a 500. With `LOG_ENABLED=false` you get no logs at all. Add a stdout JSON mode (pino → stdout when `VERCEL=1`) so Vercel Runtime Logs pick it up, and make file logging opt-in there.
- [ ] **Provision the production Turso database.** Create a dedicated prod DB with its own token, seed it from local with `pnpm db:push-turso --replace`, then run `pnpm db:verify-turso`. Confirm `TURSO_TEST_DATABASE_URL` points at a _separate_ empty DB; the open item in `.ai/issues.md` says it once pointed at the app DB.
- [ ] **Create the Vercel project and subdomain.** No Vercel project exists yet. Import `tjeastmond/Applied` and set Node 24.x. Env vars: `DATABASE_PROVIDER=turso`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, a new strong `APP_ACCESS_TOKEN` (`pnpm app:token`, not the local one), and optionally `AGENT_API_TOKEN`. Add the subdomain under Domains and point a `CNAME` from your DNS to `cname.vercel-dns.com`.

## P1 — Hardening (soon after launch)

- [ ] **CSRF Origin check.** The session cookie is `SameSite=Lax`. Every subdomain of your site counts as the _same site_, so a page on any sibling subdomain can send state-changing requests, including multipart `POST /api/backup/import` with `mode=replace`. Add an `Origin`/`Sec-Fetch-Site` check for non-GET `/api/*` in `src/proxy.ts`, skipping bearer-token requests.
- [ ] **Security headers** in `next.config.ts`: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`, and a CSP. The inline theme/page-size init script needs a hash or nonce. `fullJd` is rendered with `dangerouslySetInnerHTML`; it's sanitized on the server, so the CSP is the second layer.
- [ ] **Session revocation.** Sessions are stateless 30-day HMACs keyed on `APP_ACCESS_TOKEN`. Logout only clears the cookie, and a password change doesn't invalidate existing sessions. Add a `session_epoch` (or similar) on the user that's included in the signature and bumped on password change or "Sign Out Everywhere". This pairs with the ROADMAP item for app-token rotation in Admin.
- [ ] **Decide who owns the data (important).** Turso Sync / `db:push-turso` is one-way, local → Turso, with local SQLite as the authority. Once you're editing in production, a local push (especially `--replace`) can overwrite those edits. Choose one: prod is the source of truth (use `db:pull-turso` for local copies and hide or disable the Turso Sync button), or keep working locally and treat prod as read-mostly.
- [ ] **Scheduled production backups.** Check your Turso plan's point-in-time recovery window. Add an automated off-platform backup too, e.g. a GitHub Action or Vercel Cron that calls `GET /api/backup/export?format=json` with a bearer token and stores the result somewhere outside Turso.
- [ ] **Keep it out of search engines.** Add `robots.txt` (`Disallow: /`) and `robots: { index: false }` in root metadata. Decide whether `/agent/docs` (Scalar) and `/api/agent/openapi` should stay public; they reveal the API surface but no data.
- [ ] **Error and asset polish.** There's no `error.tsx`, `global-error.tsx`, `not-found.tsx`, favicon/app icon, or `public/` dir. Add them so failures and tabs look intentional.
- [ ] **Vercel function limits.** Vercel caps request bodies at about 4.5 MB, below the 20 MB backup-import limit. Either lower the app limit to match and show a clear error, or document that large restores go through the CLI. Set `maxDuration` explicitly on `/api/jobs/parse` (20 s fetch timeout plus the Ashby fallback) and on backup routes.
- [ ] **CI.** There's no `.github/workflows`. Add a workflow that runs `pnpm run check` on push to `main`, with the Turso test DB creds as repo secrets. Vercel builds from `main` on its own; consider gating promotion on CI.
- [ ] **Point the agent CLI at prod.** Set the CLI base URL and a prod agent token created in Settings → Agent. Check that `applied` commands work against the subdomain.

## P2 — Nice to Have

- [ ] SSRF edge cases in `src/lib/server/urlSafety.ts`: IPv4-mapped IPv6 (`::ffff:127.0.0.1`) isn't treated as private, and `parseJobUrl` reads the whole response with no size cap. Low risk on Vercel, but cheap to fix.
- [ ] Open bugs in `.ai/issues.md`: `isoDateSchema` accepts impossible dates (`2026-02-31`), and re-adding an Ashby URL creates a duplicate with the title "Jobs".
- [ ] Uptime check (e.g. a cheap authenticated or unauthenticated `/api/health` plus an external monitor) and a Vercel log drain or alerts on 5xx.
- [ ] `migrateTurso()` runs on every cold start. That's fine at this scale; watch first-request latency.
- [ ] Routine dependency bumps (`@tursodatabase/serverless` 1.4, React 19.3, `lucide-react`, `@base-ui/react`).
- [ ] Refresh the stale "Known Gaps" section in `AGENTS.md` (the status UI etc. now exists) and add a "Deploying" section once this lands.

## Explicitly Out of Scope

- Multiple users, per-user data scoping, signup, password reset by email. The app is single-owner by design (`DEFAULT_USER_ID`).

## Suggested Order

1. Dependency upgrades + `shadcn` move → `pnpm run check`
2. Setup lockdown, login rate limiting, stdout logging
3. Turso prod DB + seed → Vercel project + env → subdomain DNS
4. Smoke test in prod (login, add via parse, notes, status, backup export, agent CLI)
5. P1 hardening: Origin check, headers, data-ownership decision, backups, noindex
