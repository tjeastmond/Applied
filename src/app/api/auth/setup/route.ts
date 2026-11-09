import { getAppAccessToken, isAppAccessAuthorized } from "@/lib/appAccessAuth";
import { badRequestResponse, jsonError } from "@/lib/server/applicationRouteHelpers";
import { isAccessTokenValid } from "@/lib/server/appAuth";
import { ensureAppAccessTokenHydrated } from "@/lib/server/appAccessToken";
import { getUserRepository } from "@/lib/server/db";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import { isDevQuickLoginAvailable } from "@/lib/server/devAuth";
import { issueAppSessionResponse } from "@/lib/server/issueAppSession";
import { log } from "@/lib/server/logging/logger";
import { checkLoginThrottle, recordLoginFailure } from "@/lib/server/loginThrottle";
import { hashPassword } from "@/lib/server/passwordHash";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { setupAccountSchema } from "@/lib/schemas/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Outside local SQLite dev, setup requires the app access token (body field, bearer, or existing session). */
async function authorizeSetup(request: Request, accessToken: string | undefined): Promise<Response | null> {
  if (isDevQuickLoginAvailable()) {
    return null;
  }

  const throttled = await checkLoginThrottle(request);
  if (throttled) {
    log.warn("owner setup throttled", { route: "/api/auth/setup", method: "POST" });
    return throttled;
  }

  ensureAppAccessTokenHydrated();
  if (!getAppAccessToken()) {
    return jsonError("App access token is not configured", 503);
  }

  const authorized = accessToken ? isAccessTokenValid(accessToken) : await isAppAccessAuthorized(request);
  if (!authorized) {
    await recordLoginFailure(request);
    log.warn("owner setup rejected", { route: "/api/auth/setup", method: "POST", reason: "invalid token" });
    return jsonError("Unauthorized", 401);
  }

  return null;
}

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, setupAccountSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const authError = await authorizeSetup(request, parsed.data.accessToken);
  if (authError) {
    return authError;
  }

  const users = getUserRepository();
  await users.ensureDefaultUser();

  const { email, password, displayName } = parsed.data;

  if (await users.isEmailTaken(email, DEFAULT_USER_ID)) {
    return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
  }

  const passwordHash = hashPassword(password);
  const updated = await users.setOwnerPassword({
    email,
    passwordHash,
    displayName,
  });

  if (!updated) {
    return NextResponse.json({ error: "Account already exists" }, { status: 409 });
  }

  const sessionResponse = await issueAppSessionResponse("password-setup", "/api/auth/setup");
  if (sessionResponse.status !== 200) {
    return sessionResponse;
  }

  log.info("owner account created", { route: "/api/auth/setup", method: "POST" });

  return sessionResponse;
}
