import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as devLoginRoute } from "@/app/api/auth/dev-login/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { openDatabase } from "@/lib/server/db/migrate";
import { resetDatabaseBackend, useTestDatabase } from "@/lib/server/db";
import { flushLogs, initLogger, resetLoggerForTests } from "@/lib/server/logging/logger";
import {
  authorizedAppRequest,
  restoreAppAccessToken,
  TEST_APP_ACCESS_TOKEN,
  withTestAppAccessToken,
} from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

function parseLogMessages(contents: string): string[] {
  return contents
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => (JSON.parse(line) as { msg: string }).msg);
}

describe("auth logging", () => {
  let tempDir = "";
  let testLogFile = "";

  beforeEach(() => {
    resetLoggerForTests();
    tempDir = mkdtempSync(join(tmpdir(), "applied-auth-log-"));
    testLogFile = join(tempDir, "test.log");
    process.env.LOG_ENABLED = "true";
    process.env.LOG_LEVEL = "info";
    process.env.LOG_DIR = tempDir;
    process.env.LOG_FILE = "applied.log";
    process.env.LOG_TEST_FILE = testLogFile;
    withTestAppAccessToken();
  });

  afterEach(async () => {
    await flushLogs().catch(() => undefined);
    resetLoggerForTests();
    delete process.env.LOG_TEST_FILE;
    restoreAppAccessToken(originalAppAccessToken);
    resetDatabaseBackend();
    vi.unstubAllEnvs();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("logs token login success and failure", async () => {
    await initLogger();

    const failureResponse = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: "wrong-token" }),
      }),
    );
    expect(failureResponse.status).toBe(401);

    const successResponse = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: TEST_APP_ACCESS_TOKEN }),
      }),
    );
    expect(successResponse.status).toBe(200);

    await flushLogs();
    const messages = parseLogMessages(readFileSync(testLogFile, "utf8"));

    expect(messages).toContain("app login failed");
    expect(messages).toContain("app login succeeded");
  });

  test("logs dev login success", async () => {
    delete process.env.APP_ACCESS_TOKEN;
    vi.stubEnv("NODE_ENV", "development");
    useTestDatabase(openDatabase(":memory:"));
    await initLogger();

    const response = await devLoginRoute(new Request("http://localhost/api/auth/dev-login", { method: "POST" }));
    expect(response.status).toBe(200);

    await flushLogs();
    const messages = parseLogMessages(readFileSync(testLogFile, "utf8"));

    expect(messages).toContain("app login succeeded");
  });

  test("logs logout success and unauthorized failure", async () => {
    await initLogger();

    const failureResponse = await logoutRoute(new Request("http://localhost/api/auth/logout", { method: "POST" }));
    expect(failureResponse.status).toBe(401);

    const loginResponse = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: TEST_APP_ACCESS_TOKEN }),
      }),
    );
    const setCookie = loginResponse.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();

    const successResponse = await logoutRoute(
      authorizedAppRequest("/api/auth/logout", {
        method: "POST",
        headers: { Cookie: setCookie!.split(";")[0] },
      }),
    );
    expect(successResponse.status).toBe(200);

    await flushLogs();
    const messages = parseLogMessages(readFileSync(testLogFile, "utf8"));

    expect(messages).toContain("app logout failed");
    expect(messages).toContain("app logout succeeded");
  });
});
