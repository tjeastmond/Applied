import { beforeEach, describe, expect, test, vi } from "vitest";

const client = vi.hoisted(() => ({
  execute: vi.fn(),
  executeMultiple: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@tursodatabase/serverless/compat", () => ({ createClient: () => client }));

import { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";

describe("TursoDatabaseBackend.importSql safety", () => {
  beforeEach(() => {
    client.execute.mockReset().mockResolvedValue({ rows: [], rowsAffected: 0 });
    client.executeMultiple.mockReset().mockResolvedValue(undefined);
  });

  test.each(["replace", "upsert"] as const)("rejects unsafe SQL in %s mode before running it", async (mode) => {
    const backend = new TursoDatabaseBackend({ provider: "turso", url: "libsql://mock", authToken: "x" });

    await expect(backend.importSql("DROP TABLE applications;", mode)).rejects.toThrow();

    expect(client.executeMultiple).not.toHaveBeenCalledWith(expect.stringContaining("DROP TABLE"));
  });
});
