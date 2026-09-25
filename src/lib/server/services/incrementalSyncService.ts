import type Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import {
  SYNC_TABLES,
  emptySyncCounts,
  syncColumns,
  type IncrementalSyncResult,
  type SyncBatch,
  type SyncOperation,
  type SyncRow,
  type SyncTarget,
} from "./syncProtocol";

type State = { checkpoint: number; receipt: string | null; pending: string | null; next_batch: number };
type Plan = { id: string; checkpoint: number; batches: SyncBatch[]; result: IncrementalSyncResult };
const MAX_BATCH_ROWS = 50;
const MAX_BATCH_BYTES = 256 * 1024;

export function syncDestinationKey(url: string): string {
  const normalized = new URL(url.replace(/^libsql:/, "https:"));
  normalized.hash = "";
  normalized.search = "";
  return createHash("sha256").update(normalized.toString().replace(/\/$/, "")).digest("hex");
}

function readState(db: Database.Database, destination: string): State | undefined {
  return db
    .prepare("SELECT checkpoint, receipt, pending, next_batch FROM sync_destinations WHERE destination = ?")
    .get(destination) as State | undefined;
}

function preparePlan(
  db: Database.Database,
  destination: string,
  remoteReceipt: string | null,
  replace: boolean,
): Plan | null {
  return db
    .transaction(() => {
      const state = readState(db, destination);
      // Always finish an immutable pending snapshot before starting newer work.
      if (state?.pending && !replace) return JSON.parse(state.pending) as Plan;
      const baseline = replace || !state?.receipt;
      if (!baseline && state.receipt !== remoteReceipt) {
        throw new Error("Turso sync checkpoint changed. Run db:push-turso --replace to establish a new baseline.");
      }
      const checkpoint = (
        db.prepare("SELECT COALESCE(MAX(seq), 0) AS value FROM sqlite_sequence WHERE name = 'sync_changes'").get() as {
          value: number;
        }
      ).value;
      const operations: SyncOperation[] = [];
      for (const { table, sql } of SYNC_TABLES) {
        const columns = syncColumns(sql).join(", ");
        if (baseline) {
          for (const row of db.prepare(`SELECT ${columns} FROM ${table} ORDER BY id`).all() as SyncRow[]) {
            operations.push({ table, id: String(row.id), row });
          }
        } else {
          const ids = db
            .prepare(
              `SELECT DISTINCT record_id FROM sync_changes WHERE sequence > ? AND sequence <= ? AND table_name = ?`,
            )
            .all(state.checkpoint, checkpoint, table) as { record_id: string }[];
          const select = db.prepare(`SELECT ${columns} FROM ${table} WHERE id = ?`);
          for (const { record_id: id } of ids) {
            operations.push({ table, id, row: (select.get(id) as SyncRow | undefined) ?? null });
          }
        }
      }
      if (!baseline && operations.length === 0) return null;
      // Remove children before parents; insert parents before children. Snapshot rows
      // are persisted, so retries never read newer live values under an older cursor.
      const ordered = [
        ...operations
          .filter(
            (op) =>
              op.row === null && ["application_notes", "application_status_history", "companies"].includes(op.table),
          )
          .reverse(),
        ...operations.filter((op) => op.row !== null),
        ...operations.filter((op) => op.row === null && ["applications", "users"].includes(op.table)).reverse(),
      ];
      const id = randomUUID();
      const result: IncrementalSyncResult = {
        mode: baseline ? "baseline" : "incremental",
        imported: emptySyncCounts(),
        deleted: emptySyncCounts(),
        batches: 0,
        payloadBytes: 0,
        checkpoint,
        matches: true,
        differences: [],
      };
      const batches: SyncBatch[] = [];
      let current: SyncOperation[] = [];
      let bytes = 0;
      const flush = () => {
        batches.push({
          expected: batches.at(-1)?.receipt ?? remoteReceipt,
          receipt: `${id}:${batches.length}`,
          reset: baseline && batches.length === 0,
          operations: current,
        });
        current = [];
        bytes = 0;
      };
      for (const operation of ordered) {
        const size = Buffer.byteLength(JSON.stringify(operation));
        if (current.length && (current.length >= MAX_BATCH_ROWS || bytes + size > MAX_BATCH_BYTES)) flush();
        current.push(operation);
        bytes += size;
        const definition = SYNC_TABLES.find((entry) => entry.table === operation.table)!;
        (operation.row ? result.imported : result.deleted)[definition.key]++;
      }
      if (current.length || !batches.length) flush();
      batches[batches.length - 1].receipt += ":done";
      result.batches = batches.length;
      result.payloadBytes = Buffer.byteLength(JSON.stringify(batches));
      const plan: Plan = { id, checkpoint, batches, result };
      db.prepare(
        `INSERT INTO sync_destinations (destination, pending, pending_id) VALUES (?, ?, ?)
      ON CONFLICT(destination) DO UPDATE SET pending = excluded.pending, pending_id = excluded.pending_id, next_batch = 0`,
      ).run(destination, JSON.stringify(plan), id);
      return plan;
    })
    .immediate();
}

export async function syncIncrementally(
  db: Database.Database,
  target: SyncTarget,
  destination: string,
  replace = false,
): Promise<IncrementalSyncResult> {
  const remoteReceipt = await target.getSyncReceipt();
  const plan = preparePlan(db, destination, remoteReceipt, replace);
  if (!plan) {
    return {
      mode: "incremental",
      imported: emptySyncCounts(),
      deleted: emptySyncCounts(),
      batches: 0,
      payloadBytes: 0,
      checkpoint: readState(db, destination)!.checkpoint,
      matches: true,
      differences: [],
    };
  }
  for (;;) {
    // Do not reload/parse the potentially large saved plan for every batch.
    const state = db
      .prepare("SELECT pending_id, next_batch, receipt FROM sync_destinations WHERE destination = ?")
      .get(destination) as { pending_id: string | null; next_batch: number; receipt: string | null };
    if (state.pending_id !== plan.id) {
      if (state.receipt === plan.batches.at(-1)!.receipt) return plan.result;
      throw new Error("Sync was superseded by another run; retry to read the current checkpoint.");
    }
    const index = state.next_batch;
    const batch = plan.batches[index];
    if (!batch) throw new Error("Invalid pending sync batch");
    await target.applySyncBatch(batch);
    db.transaction(() => {
      const latest = db
        .prepare("SELECT pending_id, next_batch FROM sync_destinations WHERE destination = ?")
        .get(destination) as { pending_id: string | null; next_batch: number };
      if (latest.pending_id !== plan.id || latest.next_batch !== index) return;
      if (index + 1 < plan.batches.length) {
        db.prepare("UPDATE sync_destinations SET next_batch = ? WHERE destination = ?").run(index + 1, destination);
      } else {
        db.prepare(
          "UPDATE sync_destinations SET checkpoint = ?, receipt = ?, pending = NULL, pending_id = NULL, next_batch = 0 WHERE destination = ?",
        ).run(plan.checkpoint, batch.receipt, destination);
        // Each destination retains its own cursor. New destinations get a baseline.
        db.exec("DELETE FROM sync_changes WHERE sequence <= (SELECT MIN(checkpoint) FROM sync_destinations)");
      }
    }).immediate();
  }
}
