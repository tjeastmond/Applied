import { describe, expect, test, vi } from "vitest";
import type { Client } from "@tursodatabase/serverless/compat";
import { TursoUserRepository } from "@/lib/server/db/tursoBackend";

function repoWithRow(row: Record<string, unknown> | undefined) {
  const client = { execute: vi.fn(() => Promise.resolve({ rows: row ? [row] : [] })) } as unknown as Client;
  return new TursoUserRepository(client, Promise.resolve());
}

describe("TursoUserRepository credentials", () => {
  test("passwordless owner yields no credential instead of throwing", async () => {
    const repo = repoWithRow({ id: "u1", password_hash: null });
    await expect(repo.getCredentialById("u1")).resolves.toBeNull();
    await expect(repo.getCredentialByEmail("a@b.c")).resolves.toBeNull();
  });

  test("missing row yields null", async () => {
    await expect(repoWithRow(undefined).getCredentialById("u1")).resolves.toBeNull();
  });

  test("returns hash when set", async () => {
    await expect(repoWithRow({ id: "u1", password_hash: "h" }).getCredentialById("u1")).resolves.toEqual({
      id: "u1",
      passwordHash: "h",
    });
  });
});
