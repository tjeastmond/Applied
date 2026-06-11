import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { loadEnvFile, loadProjectEnvFiles } from "@/lib/server/loadEnvFile";

describe("loadEnvFile", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  test("loads values without overwriting existing env vars", () => {
    tempDir = mkdtempSync(join(tmpdir(), "applied-env-"));
    const envPath = join(tempDir, ".env.local");
    writeFileSync(envPath, "DATABASE_PATH=data/from-file.db\nEXISTING=from-file\n", "utf8");

    const env: Record<string, string | undefined> = { EXISTING: "keep-me" };
    loadEnvFile(envPath, env);

    expect(env.DATABASE_PATH).toBe("data/from-file.db");
    expect(env.EXISTING).toBe("keep-me");
  });

  test("loadProjectEnvFiles reads .env.local from cwd", () => {
    tempDir = mkdtempSync(join(tmpdir(), "applied-env-"));
    writeFileSync(join(tempDir, ".env.local"), "PROJECT_ENV_MARKER=loaded\n", "utf8");

    const original = process.env.PROJECT_ENV_MARKER;
    delete process.env.PROJECT_ENV_MARKER;
    loadProjectEnvFiles(tempDir);
    expect(process.env.PROJECT_ENV_MARKER).toBe("loaded");

    if (original === undefined) {
      delete process.env.PROJECT_ENV_MARKER;
    } else {
      process.env.PROJECT_ENV_MARKER = original;
    }
  });
});
