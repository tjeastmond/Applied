import { syncAppAccessTokenToEnv } from "@/lib/server/appAccessToken";
import { getAppAccessConfigRepository } from "@/lib/server/db";
import { isDevQuickLoginAvailable } from "@/lib/server/devAuth";
import { buildSessionCookieHeader } from "@/lib/server/sessionSecret";
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

  log.info("app login succeeded", { route: "/api/auth/dev-login", method: "POST", source: "dev" });

  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": await buildSessionCookieHeader(accessToken) } });
}
