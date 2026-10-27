import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as passwordLoginRoute } from "@/app/api/auth/password-login/route";
import { openDatabase } from "@/lib/server/db/migrate";
import { getLoginThrottleRepository, resetDatabaseBackend, useTestDatabase } from "@/lib/server/db";
import { SqliteLoginThrottleRepository } from "@/lib/server/db/sqliteLoginThrottleRepository";
import {
  checkLoginThrottle,
  LOGIN_THROTTLE_LIMITS,
  loginClientKey,
  recordLoginFailure,
} from "@/lib/server/loginThrottle";
import { restoreAppAccessToken, TEST_APP_ACCESS_TOKEN, withTestAppAccessToken } from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;
const CLIENT_LIMIT = LOGIN_THROTTLE_LIMITS.client.maxFailures;

function tokenLogin(accessToken: string, ip = "203.0.113.7") {
  return loginRoute(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
      body: JSON.stringify({ accessToken }),
    }),
  );
}

function passwordLogin(ip = "203.0.113.7") {
  return passwordLoginRoute(
    new Request("http://localhost/api/auth/password-login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email: "owner@example.com", password: "wrong-password" }),
    }),
  );
}

describe("SqliteLoginThrottleRepository", () => {
  test("increments within a window and restarts after the cutoff", () => {
    const repository = new SqliteLoginThrottleRepository(openDatabase(":memory:"));

    repository.recordFailure("ip:a", 1_000, 0);
    repository.recordFailure("ip:a", 2_000, 0);
    expect(repository.get("ip:a")).toEqual({ failures: 2, windowStartedAt: 1_000 });

    repository.recordFailure("ip:a", 5_000, 1_000);
    expect(repository.get("ip:a")).toEqual({ failures: 1, windowStartedAt: 5_000 });

    repository.pruneExpired(5_000);
    expect(repository.get("ip:a")).toBeNull();
  });
});

describe("login throttle", () => {
  beforeEach(() => {
    withTestAppAccessToken();
    useTestDatabase(openDatabase(":memory:"));
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
    vi.unstubAllEnvs();
    resetDatabaseBackend();
  });

  test("uses the first x-forwarded-for address as the client key", () => {
    const request = new Request("http://localhost", { headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" } });
    expect(loginClientKey(request)).toBe("ip:198.51.100.2");
    expect(loginClientKey(new Request("http://localhost"))).toBe("ip:unknown");
  });

  test("token login returns 429 with Retry-After once a client hits the limit", async () => {
    for (let attempt = 0; attempt < CLIENT_LIMIT; attempt += 1) {
      expect((await tokenLogin("wrong-token")).status).toBe(401);
    }

    const blocked = await tokenLogin(TEST_APP_ACCESS_TOKEN);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);

    const otherClient = await tokenLogin(TEST_APP_ACCESS_TOKEN, "198.51.100.9");
    expect(otherClient.status).toBe(200);
  });

  test("password login failures count toward the same client limit", async () => {
    for (let attempt = 0; attempt < CLIENT_LIMIT; attempt += 1) {
      expect((await passwordLogin()).status).toBe(401);
    }

    expect((await passwordLogin()).status).toBe(429);
  });

  test("a successful sign-in clears the client's failures", async () => {
    for (let attempt = 0; attempt < CLIENT_LIMIT - 1; attempt += 1) {
      await tokenLogin("wrong-token");
    }
    expect((await tokenLogin(TEST_APP_ACCESS_TOKEN)).status).toBe(200);
    expect(await getLoginThrottleRepository()!.get("ip:203.0.113.7")).toBeNull();
    expect((await tokenLogin("wrong-token")).status).toBe(401);
  });

  test("the block lifts once the window passes", async () => {
    const request = new Request("http://localhost", { headers: { "x-forwarded-for": "203.0.113.7" } });
    const start = 1_000_000;
    for (let attempt = 0; attempt < CLIENT_LIMIT; attempt += 1) {
      await recordLoginFailure(request, start);
    }

    expect((await checkLoginThrottle(request, start + 1_000))?.status).toBe(429);
    expect(await checkLoginThrottle(request, start + LOGIN_THROTTLE_LIMITS.client.windowMs)).toBeNull();
  });

  test("the global limit blocks every client", async () => {
    const start = Date.now();
    for (let attempt = 0; attempt < LOGIN_THROTTLE_LIMITS.global.maxFailures; attempt += 1) {
      await recordLoginFailure(
        new Request("http://localhost", { headers: { "x-forwarded-for": `198.51.100.${attempt}` } }),
        start,
      );
    }

    const fresh = new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.1" } });
    expect((await checkLoginThrottle(fresh, start + 1_000))?.status).toBe(429);
  });
});
