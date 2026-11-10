import { describe, expect, test, vi } from "vitest";
import type { Client } from "@tursodatabase/serverless/compat";
import { tursoWriteTransaction } from "@/lib/server/db/tursoRowHelpers";

function fakeClient(failOn?: string) {
  const tx = {
    closed: false,
    execute: vi.fn((statement: { sql: string }) =>
      statement.sql === failOn ? Promise.reject(new Error("network down")) : Promise.resolve(),
    ),
    commit: vi.fn(() => {
      tx.closed = true;
      return Promise.resolve();
    }),
    rollback: vi.fn(() => {
      tx.closed = true;
      return Promise.resolve();
    }),
    close: vi.fn(),
  };
  return { tx, client: { transaction: vi.fn(() => Promise.resolve(tx)) } as unknown as Client };
}

describe("tursoWriteTransaction", () => {
  test("commits all statements", async () => {
    const { tx, client } = fakeClient();
    await tursoWriteTransaction(client, [
      { sql: "A", args: [] },
      { sql: "B", args: [] },
    ]);
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(tx.commit).toHaveBeenCalled();
    expect(tx.close).toHaveBeenCalled();
  });

  test("rolls back and rethrows when a later insert fails", async () => {
    const { tx, client } = fakeClient("HISTORY");
    await expect(
      tursoWriteTransaction(client, [
        { sql: "UPDATE", args: [] },
        { sql: "HISTORY", args: [] },
      ]),
    ).rejects.toThrow("network down");
    expect(tx.commit).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalled();
    expect(tx.close).toHaveBeenCalled();
  });
});
