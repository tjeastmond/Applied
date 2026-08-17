import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_USER_DISPLAY_NAME } from "@/lib/server/defaultUser";
import { hashPassword, verifyPassword } from "@/lib/server/passwordHash";
import { openDatabase } from "@/lib/server/db/migrate";
import { getUserRepository, useTestDatabase } from "@/lib/server/db";
import { GET as getUserProfile, PATCH as patchUserProfile } from "@/app/api/user/profile/route";
import { POST as changeUserPassword } from "@/app/api/user/password/route";
import { POST as passwordLoginRoute } from "@/app/api/auth/password-login/route";
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

    const body = (await response.json()) as { displayName: string; email: string | null; hasPasswordLogin: boolean };
    expect(body.displayName).toBe(DEFAULT_USER_DISPLAY_NAME);
    expect(body.email).toBeNull();
    expect(body.hasPasswordLogin).toBe(false);
    expect(body).not.toHaveProperty("passwordHash");
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

  test("PATCH clears email when empty for token-only owners", async () => {
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

  test("PATCH requires email when password login exists", async () => {
    await getUserRepository().setOwnerPassword({
      email: "owner@example.com",
      passwordHash: hashPassword("correcthorse123"),
    });

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

    expect(response.status).toBe(400);
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

  test("POST /api/user/password rejects when password login is not configured", async () => {
    const response = await changeUserPassword(
      authorizedAppRequest("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "oldpassword1",
          newPassword: "newpassword12",
        }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(400);
  });

  test("POST /api/user/password rejects wrong current password", async () => {
    await getUserRepository().setOwnerPassword({
      email: "owner@example.com",
      passwordHash: hashPassword("correcthorse123"),
    });

    const response = await changeUserPassword(
      authorizedAppRequest("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "wrongpassword1",
          newPassword: "newpassword12",
        }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("passwordHash");
  });

  test("POST /api/user/password rejects new password matching current password", async () => {
    await getUserRepository().setOwnerPassword({
      email: "owner@example.com",
      passwordHash: hashPassword("correcthorse123"),
    });

    const response = await changeUserPassword(
      authorizedAppRequest("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "correcthorse123",
          newPassword: "correcthorse123",
        }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(400);
  });

  test("POST /api/user/password updates hash and new password works for login", async () => {
    const email = "owner@example.com";
    const oldPassword = "correcthorse123";
    const newPassword = "brandnewpass1";

    await getUserRepository().setOwnerPassword({
      email,
      passwordHash: hashPassword(oldPassword),
    });

    const credentialBefore = await getUserRepository().getCredentialById(
      (await getUserRepository().ensureDefaultUser()).id,
    );
    expect(credentialBefore).not.toBeNull();

    const response = await changeUserPassword(
      authorizedAppRequest("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: oldPassword,
          newPassword,
        }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true });
    expect(body).not.toHaveProperty("passwordHash");

    const credentialAfter = await getUserRepository().getCredentialById(
      (await getUserRepository().ensureDefaultUser()).id,
    );
    expect(credentialAfter?.passwordHash).not.toBe(credentialBefore?.passwordHash);
    expect(await verifyPassword(newPassword, credentialAfter!.passwordHash)).toBe(true);
    expect(await verifyPassword(oldPassword, credentialAfter!.passwordHash)).toBe(false);

    const oldLogin = await passwordLoginRoute(
      new Request("http://localhost/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: oldPassword }),
      }),
    );
    expect(oldLogin.status).toBe(401);

    const newLogin = await passwordLoginRoute(
      new Request("http://localhost/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: newPassword }),
      }),
    );
    expect(newLogin.status).toBe(200);
  });
});
