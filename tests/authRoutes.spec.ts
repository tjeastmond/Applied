import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { APP_SESSION_COOKIE, signSessionCookie } from "@/lib/appAccessAuth";
import { getAuthStatus } from "@/lib/server/authStatus";
import { GET as authStatusRoute } from "@/app/api/auth/status/route";
import { POST as devLoginRoute } from "@/app/api/auth/dev-login/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { openDatabase } from "@/lib/server/db/migrate";
import { getAppAccessConfigRepository, resetDatabaseBackend, useTestDatabase } from "@/lib/server/db";
import {
  authorizedAppRequest,
  restoreAppAccessToken,
  TEST_APP_ACCESS_TOKEN,
  withTestAppAccessToken,
} from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;
const originalVercel = process.env.VERCEL;

describe("auth API routes", () => {
  beforeEach(() => {
    withTestAppAccessToken();
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

  test("GET /api/auth/status reports unauthenticated session", async () => {
    withTestAppAccessToken();
    const response = await authStatusRoute(new Request("http://localhost/api/auth/status"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      authenticated: boolean;
      appAccessConfigured: boolean;
      devQuickLoginAvailable: boolean;
    };
    expect(body.authenticated).toBe(false);
    expect(body.appAccessConfigured).toBe(true);
  });

  test("getAuthStatus accepts session cookie when token is stored in database", async () => {
    delete process.env.APP_ACCESS_TOKEN;
    useTestDatabase(openDatabase(":memory:"));
    const repository = getAppAccessConfigRepository();
    expect(repository).not.toBeNull();

    const token = repository!.ensureToken();
    const sessionValue = await signSessionCookie(token, Date.now() + 60_000);
    const status = await getAuthStatus(
      new Request("http://localhost/api/auth/status", {
        headers: { Cookie: `${APP_SESSION_COOKIE}=${sessionValue}` },
      }),
    );

    expect(status.authenticated).toBe(true);
    expect(status.appAccessConfigured).toBe(true);
  });

  test("POST /api/auth/dev-login creates session in local development", async () => {
    delete process.env.APP_ACCESS_TOKEN;
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.VERCEL;
    useTestDatabase(openDatabase(":memory:"));

    const response = await devLoginRoute(new Request("http://localhost/api/auth/dev-login", { method: "POST" }));
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain(`${APP_SESSION_COOKIE}=`);

    const statusResponse = await authStatusRoute(
      new Request("http://localhost/api/auth/status", {
        headers: { Cookie: setCookie!.split(";")[0] },
      }),
    );
    const status = (await statusResponse.json()) as { authenticated: boolean; appAccessConfigured: boolean };
    expect(status.authenticated).toBe(true);
    expect(status.appAccessConfigured).toBe(true);
  });

  test("POST /api/auth/dev-login is unavailable outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await devLoginRoute(new Request("http://localhost/api/auth/dev-login", { method: "POST" }));
    expect(response.status).toBe(404);
  });

  test("POST /api/auth/login rejects invalid token", async () => {
    const response = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: "wrong-token" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  test("POST /api/auth/login sets session cookie for valid token", async () => {
    const response = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: TEST_APP_ACCESS_TOKEN }),
      }),
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain(`${APP_SESSION_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
  });

  test("POST /api/auth/logout clears session cookie when authorized", async () => {
    const loginResponse = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: TEST_APP_ACCESS_TOKEN }),
      }),
    );
    const setCookie = loginResponse.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();

    const response = await logoutRoute(
      authorizedAppRequest("/api/auth/logout", {
        method: "POST",
        headers: { Cookie: setCookie!.split(";")[0] },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain(`${APP_SESSION_COOKIE}=`);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
