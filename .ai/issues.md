# Issues

- [x] `pnpm applied:agent ... --json` emits pnpm package-script banner lines before JSON unless called with `pnpm --silent`, making direct JSON parsing fail.
- [x] Next.js hot reload can retain a stale global database backend created before a newly added repository exists, causing runtime routes to receive an undefined repository despite fresh-process tests passing.
- [ ] Re-adding the Hopper Ashby URL via `applied-agent applications add` created a duplicate application with generic title `Jobs` instead of detecting the existing parsed application or rejecting generic ATS shell captures.
- [ ] `isoDateSchema` accepts normalized impossible calendar dates such as `2026-02-31` because it only checks whether `Date.parse` returns a number.
- [x] Rapid analytics filter changes could overwrite a preceding selection because event handlers composed URLs from render-time filter state instead of the latest browser query.
