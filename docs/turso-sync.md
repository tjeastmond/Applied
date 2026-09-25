# Incremental Turso sync

Turso Sync in Settings and `pnpm db:push-turso` push local SQLite changes to Turso. Local SQLite is authoritative; this is not two-way replication.

## Operation

The first run replaces the five backed-up tables with a baseline. Subsequent runs send changed records and explicit deletions only. Notes are tracked even though they have no update timestamp. Repeated edits to one record collapse into one upsert. A no-op sends no record payload (it still checks remote metadata and initializes the backend).

SQLite triggers append record IDs to `sync_changes` in the original write transaction. A short SQLite transaction captures a fixed sequence boundary and the current values of affected records. It persists an immutable plan in `sync_destinations`, separately for each destination. Changes made during network transfer stay queued for the next run.

Plans are divided into at most 50 row operations or approximately 256 KiB of record data per batch; an individual oversized row is sent alone. Each Turso write transaction applies its operations and a receipt together, using sequential statements to avoid the known batch-binding issue. Receipts reject stale writes and recognize lost commit responses. Local progress advances only after acknowledgement. Retries resume the saved plan. Journal entries are pruned only after all known destinations have passed them.

A sync spanning several batches is not atomic as a whole: a failed baseline may leave a partial target until resumed. Parents precede new children, child deletions precede parent deletions, and pending remote baselines suppress history/company backfills during startup. Do not edit the hosted application during reconciliation.

## Recovery and compatibility

- `pnpm db:push-turso`: incremental sync, or resume a pending plan.
- `pnpm db:push-turso --replace`: discard a pending plan and build a new full baseline from local data.
- `pnpm db:push-turso --upsert`: legacy full merge; sends every record, preserves target-only rows, and invalidates the incremental baseline.
- `pnpm db:pull-turso [--upsert]`: unchanged full pull. Local triggers track imported changes.
- JSON/SQL exports/imports and downloadable backups retain their existing formats. JSON/SQL omit sync metadata and credentials. Raw SQLite backups contain local sync bookkeeping; a restored stale checkpoint is rejected if the remote receipt has advanced.
- Full Turso imports invalidate the receipt. Resume with `--replace` after a restore or checkpoint mismatch.

Remote receipt checks prove ordered commits, not whole-database equality. Ordinary hosted edits do not update these receipts and are not downloaded or conflict-resolved. Use explicit reconciliation if both copies diverge. `db:verify-turso` retains the existing counts/latest-timestamp comparison; it is not a content checksum.

The returned `payloadBytes` measures serialized planned batch data, not wire traffic or billing. Retrying part of a plan reports the original plan totals. Checkpoints advance per completed plan, with persisted batch progress between commits.

## Verification

`tests/incrementalSync.spec.ts` runs the production transaction adapter against real in-memory SQLite through a driver shim. It checks complete contents of all five tables, rollback, lost acknowledgement, concurrent edits, deletion cascades, independent destination checkpoints, credential exclusion, and payload reduction. `tests/incrementalSyncTurso.spec.ts` repeats key scenarios with the actual Turso driver and a dedicated empty test database.

All remote tests require `TURSO_TEST_DATABASE_URL` and `TURSO_TEST_AUTH_TOKEN`. The test helper rejects the app database hostname, including alternate libsql/HTTPS spellings. These suites intentionally fail rather than skip if safe test credentials are unavailable.
