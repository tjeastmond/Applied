import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_USER_DISPLAY_NAME } from "@/lib/server/defaultUser";
import { openDatabase } from "@/lib/server/db/migrate";
import { getUserRepository, useTestDatabase } from "@/lib/server/db";
import { GET as getUserProfile, PATCH as patchUserProfile } from "@/app/api/user/profile/route";
import { authorizedAppRequest, emptyRouteContext, restoreAppAccessToken, withTestAppAccessToken } from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

describe("user profile API routes", () => {
  beforeEach(() => {
    withTestAppAccessToken();
    useTestDatabase(openDatabase(":memory:"));
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
  });

  test("GET returns the default user profile", async () => {
    const response = await getUserProfile(authorizedAppRequest("/api/user/profile"), emptyRouteContext);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { displayName: string; email: string | null };
    expect(body.displayName).toBe(DEFAULT_USER_DISPLAY_NAME);
    expect(body.email).toBeNull();
  });

  test("PATCH updates name and email", async () => {
    const response = await patchUserProfile(
      authorizedAppRequest("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Taylor Eastmond",
          email: "taylor@example.com",
        }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { displayName: string; email: string | null };
    expect(body.displayName).toBe("Taylor Eastmond");
    expect(body.email).toBe("taylor@example.com");

    const user = await getUserRepository().ensureDefaultUser();
    expect(user.displayName).toBe("Taylor Eastmond");
    expect(user.email).toBe("taylor@example.com");
  });

  test("PATCH clears email when empty", async () => {
    await patchUserProfile(
      authorizedAppRequest("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Taylor Eastmond",
          email: "taylor@example.com",
        }),
      }),
      emptyRouteContext,
    );

    const response = await patchUserProfile(
      authorizedAppRequest("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Taylor Eastmond",
          email: null,
        }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { email: string | null };
    expect(body.email).toBeNull();
  });

  test("PATCH rejects empty display name", async () => {
    const response = await patchUserProfile(
      authorizedAppRequest("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "   ",
          email: null,
        }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(400);
  });

  test("PATCH rejects invalid email", async () => {
    const response = await patchUserProfile(
      authorizedAppRequest("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Taylor Eastmond",
          email: "not-an-email",
        }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(400);
  });
});
