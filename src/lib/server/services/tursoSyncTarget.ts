import { requiredString } from "../db/tursoRowHelpers";
import type { Client } from "@tursodatabase/serverless/compat";
import { SYNC_RECEIPT_SCHEMA, SYNC_TABLES, type SyncBatch, type SyncTarget } from "./syncProtocol";

export function createTursoSyncTarget(client: Client): SyncTarget {
  return {
    async getSyncReceipt() {
      await client.execute(SYNC_RECEIPT_SCHEMA);
      const result = await client.execute("SELECT receipt FROM sync_receipt WHERE id = 1");
      return result.rows[0] ? requiredString(result.rows[0], "receipt") : null;
    },
    async applySyncBatch(batch: SyncBatch) {
      const tx = await client.transaction("write");
      try {
        const result = await tx.execute("SELECT receipt FROM sync_receipt WHERE id = 1");
        const receipt = result.rows[0] ? requiredString(result.rows[0], "receipt") : null;
        if (receipt === batch.receipt) {
          await tx.rollback();
          return; // The commit succeeded but its acknowledgement was lost.
        }
        if (receipt !== batch.expected)
          throw new Error("Turso sync checkpoint changed; retry sync or use --replace to rebuild the baseline.");
        if (batch.reset) {
          for (const { table } of [...SYNC_TABLES].reverse()) await tx.execute(`DELETE FROM ${table}`);
        }
        for (const operation of batch.operations) {
          const definition = SYNC_TABLES.find((entry) => entry.table === operation.table);
          if (!definition) throw new Error("Unknown sync table");
          await tx.execute(
            operation.row
              ? { sql: definition.sql, args: operation.row }
              : { sql: `DELETE FROM ${definition.table} WHERE id = ?`, args: [operation.id] },
          );
        }
        await tx.execute({
          sql: "INSERT INTO sync_receipt (id, receipt) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET receipt = excluded.receipt",
          args: [batch.receipt],
        });
        await tx.commit();
      } catch (error) {
        if (!tx.closed) await tx.rollback().catch(() => undefined);
        throw error;
      } finally {
        tx.close();
      }
    },
  };
}
