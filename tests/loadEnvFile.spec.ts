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

  test("loadProjectEnvFiles reads APPLIED_DEV_DIR checkout before cwd", () => {
    const checkoutDir = mkdtempSync(join(tmpdir(), "applied-env-checkout-"));
    tempDir = mkdtempSync(join(tmpdir(), "applied-env-cwd-"));
    writeFileSync(join(checkoutDir, ".env.local"), "PROJECT_ENV_MARKER=from-checkout\n", "utf8");
    writeFileSync(join(tempDir, ".env.local"), "PROJECT_ENV_MARKER=from-cwd\n", "utf8");

    const originalDir = process.env.APPLIED_DEV_DIR;
    const originalMarker = process.env.PROJECT_ENV_MARKER;
    process.env.APPLIED_DEV_DIR = checkoutDir;
    delete process.env.PROJECT_ENV_MARKER;

    loadProjectEnvFiles(tempDir);
    expect(process.env.PROJECT_ENV_MARKER).toBe("from-checkout");

    if (originalDir === undefined) {
      delete process.env.APPLIED_DEV_DIR;
    } else {
      process.env.APPLIED_DEV_DIR = originalDir;
    }

    if (originalMarker === undefined) {
      delete process.env.PROJECT_ENV_MARKER;
    } else {
      process.env.PROJECT_ENV_MARKER = originalMarker;
    }

    rmSync(checkoutDir, { recursive: true, force: true });
  });

  test("loadProjectEnvFiles keeps shell-exported agent keys over .env.local", () => {
    tempDir = mkdtempSync(join(tmpdir(), "applied-env-"));
    writeFileSync(
      join(tempDir, ".env.local"),
      [
        "AGENT_API_TOKEN=from-env-file",
        "APPLIED_DEV_URL=https://env-file.example",
        "APPLIED_DEV_DIR=/should-not-replace",
      ].join("\n"),
      "utf8",
    );

    const originalToken = process.env.AGENT_API_TOKEN;
    const originalUrl = process.env.APPLIED_DEV_URL;
    const originalDir = process.env.APPLIED_DEV_DIR;

    process.env.AGENT_API_TOKEN = "from-shell";
    process.env.APPLIED_DEV_URL = "https://shell.example";
    process.env.APPLIED_DEV_DIR = "/from-shell";

    loadProjectEnvFiles(tempDir);

    expect(process.env.AGENT_API_TOKEN).toBe("from-shell");
    expect(process.env.APPLIED_DEV_URL).toBe("https://shell.example");
    expect(process.env.APPLIED_DEV_DIR).toBe("/from-shell");

    if (originalToken === undefined) {
      delete process.env.AGENT_API_TOKEN;
    } else {
      process.env.AGENT_API_TOKEN = originalToken;
    }

    if (originalUrl === undefined) {
      delete process.env.APPLIED_DEV_URL;
    } else {
      process.env.APPLIED_DEV_URL = originalUrl;
    }

    if (originalDir === undefined) {
      delete process.env.APPLIED_DEV_DIR;
    } else {
      process.env.APPLIED_DEV_DIR = originalDir;
    }
  });

  test("loadProjectEnvFiles loads missing agent keys from APPLIED_DEV_DIR checkout", () => {
    const checkoutDir = mkdtempSync(join(tmpdir(), "applied-env-checkout-"));
    tempDir = mkdtempSync(join(tmpdir(), "applied-env-cwd-"));
    writeFileSync(
      join(checkoutDir, ".env.local"),
      "AGENT_API_TOKEN=from-checkout\nAPPLIED_DEV_URL=https://checkout.example\n",
      "utf8",
    );

    const originalToken = process.env.AGENT_API_TOKEN;
    const originalUrl = process.env.APPLIED_DEV_URL;
    const originalDir = process.env.APPLIED_DEV_DIR;

    delete process.env.AGENT_API_TOKEN;
    delete process.env.APPLIED_DEV_URL;
    process.env.APPLIED_DEV_DIR = checkoutDir;

    loadProjectEnvFiles(tempDir);

    expect(process.env.AGENT_API_TOKEN).toBe("from-checkout");
    expect(process.env.APPLIED_DEV_URL).toBe("https://checkout.example");

    if (originalToken === undefined) {
      delete process.env.AGENT_API_TOKEN;
    } else {
      process.env.AGENT_API_TOKEN = originalToken;
    }

    if (originalUrl === undefined) {
      delete process.env.APPLIED_DEV_URL;
    } else {
      process.env.APPLIED_DEV_URL = originalUrl;
    }

    if (originalDir === undefined) {
      delete process.env.APPLIED_DEV_DIR;
    } else {
      process.env.APPLIED_DEV_DIR = originalDir;
    }

    rmSync(checkoutDir, { recursive: true, force: true });
  });
});
