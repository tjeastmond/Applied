# DRY Review

The strongest DRY wins are in the API and backend layers. The agent review mostly confirmed the same hotspots and added one extra good catch: duplicated SQL constants in the agent-token repositories.

| Priority | Area | Evidence | Recommendation |
| --- | --- | --- | --- |
| High | Route auth boilerplate | `requireAppAccess()` prelude repeats across 20+ handlers, e.g. `src/app/api/applications/route.ts:12-17`, `src/app/api/applications/[id]/route.ts:18-23`, `src/app/api/admin/agent-tokens/route.ts:13-18` | Add a small route wrapper like `withAppAccess(handler)` to centralize the auth guard. |
| High | Agent-token backend duplication | `src/lib/server/db/sqliteAgentApiTokenRepository.ts` and `src/lib/server/db/tursoAgentApiTokenRepository.ts` duplicate SQL, record construction, and CRUD structure | Create `agentTokenRepositoryShared.ts` for SQL/constants and shared mapping/build helpers, then keep only transport-specific execution in each backend. |
| Medium | Turso DB helper duplication | `requiredString`, `nullableString`, `rows`, `firstRow` are duplicated in `src/lib/server/db/tursoBackend.ts` and `src/lib/server/db/tursoAgentApiTokenRepository.ts` | Extract a `tursoRowHelpers.ts` or similar. |
| Medium | Application/note param resolution | Repeated `requireApplicationId(rawId)` flows in `src/app/api/applications/[id]/route.ts`, `src/app/api/applications/[id]/notes/route.ts`, `src/app/api/applications/[id]/notes/[noteId]/route.ts` | Add helpers like `requireApplicationRouteContext()` / `requireApplicationNoteRouteContext()` that resolve params and return the correct not-found response. |
| Medium | Agent-token route repository checks | `getAgentApiTokenRepository()` + `503` handling repeats in `src/app/api/admin/agent-tokens/route.ts`, `[id]/route.ts`, `from-env/route.ts` | Add `requireAgentTokenRepository()` helper. |
| Low-Medium | Request parsing boilerplate | `parseRequestBody(...); if (!parsed.ok) return badRequestResponse(parsed.error);` appears across many routes | A small parse helper returning `Response | data` would reduce repetition if you’re already touching those files. |
| Low | Bearer/auth utility duplication | `bearerTokenFromRequest()` exists in both `src/lib/server/bearerAuth.ts` and `src/lib/appAccessAuth.ts` | Keep one implementation and reuse it. |
| Low | Filter wrapper components | `src/components/CompanyFilter.tsx` and `src/components/StatusFilter.tsx` are thin wrappers around `MultiSelectFilter` | Only worth merging if you’re already refactoring filters; current split is still readable. |

## Best first refactor sequence

1. Route wrapper for `requireAppAccess()`
2. Shared agent-token repository module
3. Shared Turso row/query helpers

That would remove the most duplication with the lowest behavioral risk.
