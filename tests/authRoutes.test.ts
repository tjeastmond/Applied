import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { APP_SESSION_COOKIE } from "@/lib/appAccessAuth";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import {
  authorizedAppRequest,
  restoreAppAccessToken,
  TEST_APP_ACCESS_TOKEN,
  withTestAppAccessToken,
} from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

describe("auth API routes", () => {
  beforeEach(() => {
    withTestAppAccessToken();
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
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
