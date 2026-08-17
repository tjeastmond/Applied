import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { APP_SESSION_COOKIE, signSessionCookie } from "@/lib/appAccessAuth";
import { getAuthStatus } from "@/lib/server/authStatus";
import { GET as authStatusRoute } from "@/app/api/auth/status/route";
import { POST as devLoginRoute } from "@/app/api/auth/dev-login/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as passwordLoginRoute } from "@/app/api/auth/password-login/route";
import { POST as setupRoute } from "@/app/api/auth/setup/route";
import { GET as listApplicationsRoute } from "@/app/api/applications/route";
import { openDatabase } from "@/lib/server/db/migrate";
import {
  getAppAccessConfigRepository,
  getUserRepository,
  resetDatabaseBackend,
  useTestDatabase,
} from "@/lib/server/db";
import { hashPassword } from "@/lib/server/passwordHash";
import { stripSensitiveDataFromDatabase } from "@/lib/server/services/databaseBackupService";
import { exportJson, importJson } from "@/lib/server/services/backupService";
import { emptyRouteContext, restoreAppAccessToken, TEST_APP_ACCESS_TOKEN, withTestAppAccessToken } from "./testAppAuth";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;
const originalVercel = process.env.VERCEL;

const TEST_EMAIL = "owner@example.com";
const TEST_PASSWORD = "correcthorse123";

async function setupOwnerAccount() {
  const response = await setupRoute(
    new Request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        displayName: "Owner",
      }),
    }),
  );
  expect(response.status).toBe(200);
  return response.headers.get("Set-Cookie");
}

describe("password auth API routes", () => {
  beforeEach(() => {
    delete process.env.APP_ACCESS_TOKEN;
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.VERCEL;
    useTestDatabase(openDatabase(":memory:"));
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
    vi.unstubAllEnvs();
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }
    resetDatabaseBackend();
  });

  test("GET /api/auth/status exposes setupRequired and omits email or hash", async () => {
    const response = await authStatusRoute(new Request("http://localhost/api/auth/status"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.setupRequired).toBe(true);
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("passwordHash");
  });

  test("setup creates owner credentials once and flips setupRequired", async () => {
    await setupOwnerAccount();

    const duplicate = await setupRoute(
      new Request("http://localhost/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "other@example.com",
          password: "anotherpassword1",
          displayName: "Other Owner",
        }),
      }),
    );
    expect(duplicate.status).toBe(409);

    const status = await getAuthStatus(new Request("http://localhost/api/auth/status"));
    expect(status.setupRequired).toBe(false);
  });

  test("password login succeeds and authorizes protected routes", async () => {
    await setupOwnerAccount();

    const response = await passwordLoginRoute(
      new Request("http://localhost/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      }),
    );
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain(`${APP_SESSION_COOKIE}=`);

    const appsResponse = await listApplicationsRoute(
      new Request("http://localhost/api/applications", {
        headers: { Cookie: setCookie!.split(";")[0] },
      }),
      emptyRouteContext,
    );
    expect(appsResponse.status).toBe(200);
  });

  test("password login returns identical 401 for unknown email and bad password", async () => {
    await setupOwnerAccount();

    const unknownEmailResponse = await passwordLoginRoute(
      new Request("http://localhost/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "missing@example.com", password: TEST_PASSWORD }),
      }),
    );
    const badPasswordResponse = await passwordLoginRoute(
      new Request("http://localhost/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_EMAIL, password: "wrongpassword1" }),
      }),
    );

    expect(unknownEmailResponse.status).toBe(401);
    expect(badPasswordResponse.status).toBe(401);
    expect(await unknownEmailResponse.json()).toEqual(await badPasswordResponse.json());
  });

  test("password login hydrates sqlite app access token when env token is missing", async () => {
    await setupOwnerAccount();

    const response = await passwordLoginRoute(
      new Request("http://localhost/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      }),
    );
    expect(response.status).toBe(200);

    const repository = getAppAccessConfigRepository();
    expect(repository?.getToken()).toBeTruthy();
  });

  test("token login and dev-login still work alongside password auth", async () => {
    withTestAppAccessToken();
    await setupOwnerAccount();

    const tokenResponse = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: TEST_APP_ACCESS_TOKEN }),
      }),
    );
    expect(tokenResponse.status).toBe(200);

    const devResponse = await devLoginRoute(new Request("http://localhost/api/auth/dev-login", { method: "POST" }));
    expect(devResponse.status).toBe(200);
  });

  test("user JSON responses never include passwordHash", async () => {
    await setupOwnerAccount();
    const user = await getUserRepository().ensureDefaultUser();
    expect(user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(user)).not.toContain("passwordHash");
  });

  test("setup rejects missing displayName", async () => {
    const response = await setupRoute(
      new Request("http://localhost/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        }),
      }),
    );
    expect(response.status).toBe(400);
  });

  test("stores emails lowercased and enforces uniqueness", async () => {
    await setupRoute(
      new Request("http://localhost/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "Owner@Example.COM",
          password: TEST_PASSWORD,
          displayName: "Owner",
        }),
      }),
    );

    const user = await getUserRepository().ensureDefaultUser();
    expect(user.email).toBe("owner@example.com");
  });

  test("backup export omits password hashes and upsert preserves existing hash", async () => {
    const db = openDatabase(":memory:");
    useTestDatabase(db);
    await setupOwnerAccount();

    const exported = exportJson(db);
    expect(JSON.stringify(exported)).not.toContain("passwordHash");
    expect(JSON.stringify(exported)).not.toContain("password_hash");
    expect(await getUserRepository().hasPasswordLogin()).toBe(true);

    importJson(db, exported, "upsert");

    expect(await getUserRepository().hasPasswordLogin()).toBe(true);
    expect(await getUserRepository().getCredentialByEmail(TEST_EMAIL)).not.toBeNull();
  });

  test("stripSensitiveDataFromDatabase nulls password hashes", async () => {
    const dbPath = join(tmpdir(), `applied-password-strip-${randomUUID()}.db`);
    const db = openDatabase(dbPath);
    useTestDatabase(db);
    await getUserRepository().setOwnerPassword({
      email: TEST_EMAIL,
      passwordHash: hashPassword(TEST_PASSWORD),
    });
    expect(await getUserRepository().hasPasswordLogin()).toBe(true);
    db.close();

    stripSensitiveDataFromDatabase(dbPath);

    const reopened = openDatabase(dbPath);
    useTestDatabase(reopened);
    expect(await getUserRepository().hasPasswordLogin()).toBe(false);
    reopened.close();
    rmSync(dbPath, { force: true });
  });
});

describe("auth status with password login", () => {
  beforeEach(() => {
    delete process.env.APP_ACCESS_TOKEN;
    useTestDatabase(openDatabase(":memory:"));
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
    resetDatabaseBackend();
  });

  test("authenticated session cookie still works after password setup", async () => {
    await setupOwnerAccount();
    const token = getAppAccessConfigRepository()!.ensureToken();
    const sessionValue = await signSessionCookie(token, Date.now() + 60_000);
    const status = await getAuthStatus(
      new Request("http://localhost/api/auth/status", {
        headers: { Cookie: `${APP_SESSION_COOKIE}=${sessionValue}` },
      }),
    );
    expect(status.authenticated).toBe(true);
    expect(status.setupRequired).toBe(false);
  });
});
