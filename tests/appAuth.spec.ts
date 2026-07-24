import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { APP_SESSION_COOKIE, getAppAccessToken, isAppAccessAuthorized, signSessionCookie } from "@/lib/appAccessAuth";
import { isAccessTokenValid, requireAppAccess } from "@/lib/server/appAuth";
import { restoreAppAccessToken, TEST_APP_ACCESS_TOKEN, withTestAppAccessToken } from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

describe("appAuth", () => {
  beforeEach(() => {
    withTestAppAccessToken();
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
  });

  test("requireAppAccess rejects missing bearer token", async () => {
    const response = await requireAppAccess(new Request("http://localhost/api/applications"));
    expect(response?.status).toBe(401);
  });

  test("requireAppAccess accepts valid bearer token", async () => {
    const response = await requireAppAccess(
      new Request("http://localhost/api/applications", {
        headers: { Authorization: `Bearer ${TEST_APP_ACCESS_TOKEN}` },
      }),
    );
    expect(response).toBeNull();
  });

  test("requireAppAccess accepts valid session cookie", async () => {
    const expiresAt = Date.now() + 60_000;
    const sessionValue = await signSessionCookie(TEST_APP_ACCESS_TOKEN, expiresAt);
    const response = await requireAppAccess(
      new Request("http://localhost/api/applications", {
        headers: { Cookie: `${APP_SESSION_COOKIE}=${sessionValue}` },
      }),
    );
    expect(response).toBeNull();
  });

  test("isAccessTokenValid compares tokens in constant time", () => {
    expect(isAccessTokenValid(TEST_APP_ACCESS_TOKEN)).toBe(true);
    expect(isAccessTokenValid("wrong-token")).toBe(false);
  });

  test("getAppAccessToken returns configured token", () => {
    expect(getAppAccessToken()).toBe(TEST_APP_ACCESS_TOKEN);
  });

  test("isAppAccessAuthorized returns false when token is not configured", async () => {
    delete process.env.APP_ACCESS_TOKEN;
    const authorized = await isAppAccessAuthorized(
      new Request("http://localhost/api/applications", {
        headers: { Authorization: `Bearer ${TEST_APP_ACCESS_TOKEN}` },
      }),
    );
    expect(authorized).toBe(false);
  });
});
