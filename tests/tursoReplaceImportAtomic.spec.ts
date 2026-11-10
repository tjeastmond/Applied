import { describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import { requireTursoTestConfig } from "./helpers/tursoTestConfig";

describe("TursoDatabaseBackend replace import atomicity", () => {
  test("a failing last row rolls back the whole replace import", async () => {
    const tursoConfig = requireTursoTestConfig();
    const backend = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });
    const empty = { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] };

    try {
      await backend.importJson(empty, "replace");
      const kept = await backend.applications.create(
        createJobApplicationSchema.parse({
          url: "https://jobs.example.com/atomic-keep",
          title: "Keeper",
          company: "Acme",
          appliedAt: "2026-06-01",
        }),
      );
      const entry = {
        id: crypto.randomUUID(),
        applicationId: kept.id,
        userId: DEFAULT_USER_ID,
        fromStatus: null,
        toStatus: "applied" as const,
        changedAt: new Date().toISOString(),
      };
      const incoming = { ...kept, id: crypto.randomUUID(), title: "Incoming" };

      await expect(
        backend.importJson(
          {
            version: 3,
            exportedAt: new Date().toISOString(),
            applications: [incoming],
            notes: [],
            users: [],
            // Duplicate primary key: the last INSERT fails after the DROPs and earlier INSERTs ran.
            statusHistory: [entry, entry],
            companies: [],
          },
          "replace",
        ),
      ).rejects.toThrow();

      const after = await backend.applications.list();
      expect(after.map((a) => a.id)).toEqual([kept.id]);
    } finally {
      await backend.importJson(empty, "replace");
      backend.reset();
    }
  }, 30_000);
});
