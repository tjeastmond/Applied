import { buildSessionSetCookieHeader, SESSION_MAX_AGE_SECONDS, signSessionCookie } from "@/lib/appAccessAuth";
import { syncAppAccessTokenToEnv } from "@/lib/server/appAccessToken";
import { getAppAccessConfigRepository } from "@/lib/server/db";
import { isDevQuickLoginAvailable } from "@/lib/server/devAuth";
import { log } from "@/lib/server/logging/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  void request;
  if (!isDevQuickLoginAvailable()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const repository = getAppAccessConfigRepository();
  if (!repository) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accessToken = repository.ensureToken();
  syncAppAccessTokenToEnv(accessToken);

  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const sessionValue = await signSessionCookie(accessToken, expiresAt);

  log.info("app login succeeded", { route: "/api/auth/dev-login", method: "POST", source: "dev" });

  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": buildSessionSetCookieHeader(sessionValue) } });
}
